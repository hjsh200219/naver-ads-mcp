// L2 service: aggregate DailyRawJsonRow[] for two weeks into a
// PrecomputedPayload for the AI analyzer. Pure (no IO).

import type { DailyRawJsonRow } from "./excel-template.js";
import { buildKpiSummary, buildWowDelta, pctDelta } from "./precompute-kpi.js";
import type {
  DeviceRow,
  KpiSummary,
  MediaBlock,
  PrecomputedPayload,
  WowDelta,
} from "./types.js";

export interface AggregateArgs {
  advertiser: string;
  rows: DailyRawJsonRow[];
  /** Weekly label as used in 일별RAW 주차 column, e.g. "2026-05-04주차". */
  targetWeek: string;
  compareWeek: string;
  industry?: string;
}

interface MediaAccumulator {
  media: "powerlink" | "shopping";
  label: string;
  byDevice: Map<string, KpiSummary>;
  total: KpiSummary;
}

const CAMPAIGN_TO_MEDIA: Record<
  string,
  { media: "powerlink" | "shopping"; label: string }
> = {
  파워링크: { media: "powerlink", label: "파워링크" },
  쇼핑검색: { media: "shopping", label: "쇼핑검색" },
};

function emptyKpi(): KpiSummary {
  return {
    impressions: 0,
    clicks: 0,
    cost: 0,
    conversions: 0,
    revenue: 0,
    roas: 0,
  };
}

function addInPlace(target: KpiSummary, row: DailyRawJsonRow): void {
  target.impressions += row["노출수"] || 0;
  target.clicks += row["클릭수"] || 0;
  target.cost += row["광고비 (VAT-)"] || 0;
  // Conversions = sum of 4 conversion-type columns
  target.conversions +=
    (row["구매완료"] || 0) +
    (row["회원가입"] || 0) +
    (row["신청완료"] || 0) +
    (row["기타전환"] || 0);
  target.revenue += row["전환매출액"] || 0;
}

function finalizeRoas(kpi: KpiSummary): KpiSummary {
  return { ...kpi, roas: kpi.cost === 0 ? 0 : (kpi.revenue / kpi.cost) * 100 };
}

function periodFromRows(rows: DailyRawJsonRow[]): {
  start: string;
  end: string;
} {
  if (rows.length === 0) return { start: "", end: "" };
  const dates = rows
    .map((r) => r["날짜"])
    .filter((d): d is string => typeof d === "string" && d.length > 0)
    .sort();
  return { start: dates[0] ?? "", end: dates[dates.length - 1] ?? "" };
}

function aggregateOneWeek(
  rows: DailyRawJsonRow[],
  weekLabel: string,
): {
  kpi: KpiSummary;
  media: Map<string, MediaAccumulator>;
  period: { start: string; end: string };
} {
  const filtered = rows.filter((r) => r["주차"] === weekLabel);
  const totalKpi = emptyKpi();
  const mediaMap = new Map<string, MediaAccumulator>();

  for (const row of filtered) {
    addInPlace(totalKpi, row);

    const campaignType = String(row["캠페인유형"] ?? "");
    const meta = CAMPAIGN_TO_MEDIA[campaignType];
    if (!meta) continue; // skip 브랜드검색 / 파워컨텐츠 in 매체 표 (data_warnings will note)

    let acc = mediaMap.get(meta.label);
    if (!acc) {
      acc = {
        media: meta.media,
        label: meta.label,
        byDevice: new Map(),
        total: emptyKpi(),
      };
      mediaMap.set(meta.label, acc);
    }
    addInPlace(acc.total, row);

    const device = String(row["디바이스"] ?? "").toUpperCase();
    if (device === "PC" || device === "MO") {
      let dev = acc.byDevice.get(device);
      if (!dev) {
        dev = emptyKpi();
        acc.byDevice.set(device, dev);
      }
      addInPlace(dev, row);
    }
  }
  return {
    kpi: finalizeRoas(totalKpi),
    media: mediaMap,
    period: periodFromRows(filtered),
  };
}

function buildMediaBlocks(
  curMap: Map<string, MediaAccumulator>,
  prevMap: Map<string, MediaAccumulator>,
): MediaBlock[] {
  const blocks: MediaBlock[] = [];
  for (const [label, cur] of curMap) {
    const prev = prevMap.get(label);
    const rows: DeviceRow[] = [];
    const total = finalizeRoas(cur.total);
    rows.push({
      device: "TOTAL",
      ...total,
    });
    const pc = cur.byDevice.get("PC");
    const mo = cur.byDevice.get("MO");
    if (pc) {
      const f = finalizeRoas(pc);
      rows.push({ device: "PC", ...f });
    }
    if (mo) {
      const f = finalizeRoas(mo);
      rows.push({ device: "MO", ...f });
    }
    const wow: WowDelta = prev
      ? buildWowDelta(finalizeRoas(cur.total), finalizeRoas(prev.total))
      : {
          impressions_pct: 0,
          clicks_pct: 0,
          cost_pct: 0,
          conversions_pct: 0,
          revenue_pct: 0,
          roas_pct: 0,
        };
    blocks.push({ media: cur.media, label, rows, wow });
  }
  return blocks;
}

export function aggregateWeeklyPayload(
  args: AggregateArgs,
): PrecomputedPayload {
  const cur = aggregateOneWeek(args.rows, args.targetWeek);
  const prev = aggregateOneWeek(args.rows, args.compareWeek);

  const kpi_current = buildKpiSummary({
    impressions: cur.kpi.impressions,
    clicks: cur.kpi.clicks,
    cost: cur.kpi.cost,
    conversions: cur.kpi.conversions,
    revenue: cur.kpi.revenue,
  });
  const kpi_previous = buildKpiSummary({
    impressions: prev.kpi.impressions,
    clicks: prev.kpi.clicks,
    cost: prev.kpi.cost,
    conversions: prev.kpi.conversions,
    revenue: prev.kpi.revenue,
  });

  const media = buildMediaBlocks(cur.media, prev.media);
  const data_warnings: string[] = [];

  // Always note 브랜드검색 area-level missing (Naver API limit)
  const hasBrandSearch = args.rows.some(
    (r) => r["캠페인유형"] === "브랜드검색",
  );
  if (hasBrandSearch) {
    data_warnings.push("브랜드검색 영역별 성과: Naver API 미제공");
  }
  if (cur.kpi.impressions === 0 && cur.kpi.clicks === 0) {
    data_warnings.push("금주(주차) 데이터 없음");
  }

  return {
    advertiser: args.advertiser,
    industry: args.industry,
    report_period: cur.period,
    compare_period: prev.period,
    kpi_current,
    kpi_previous,
    kpi_wow: {
      impressions_pct: pctDelta(
        kpi_current.impressions,
        kpi_previous.impressions,
      ),
      clicks_pct: pctDelta(kpi_current.clicks, kpi_previous.clicks),
      cost_pct: pctDelta(kpi_current.cost, kpi_previous.cost),
      conversions_pct: pctDelta(
        kpi_current.conversions,
        kpi_previous.conversions,
      ),
      revenue_pct: pctDelta(kpi_current.revenue, kpi_previous.revenue),
      roas_pct: pctDelta(kpi_current.roas, kpi_previous.roas),
    },
    media,
    data_warnings,
  };
}
