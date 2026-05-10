// L2 service: daily aggregator. Sums rows by date column, derives DoD/MoM
// deltas, and computes the three threshold-engine metrics (roas_mom_pct,
// cpc_mom_pct, impressions_dod_pct). Pure (no IO).

import type { DailyRawJsonRow } from "./excel-template.js";
import type { KpiSummary } from "./types.js";
import { buildKpiSummary, pctDelta } from "./precompute-kpi.js";

export interface AggregateDailyArgs {
  advertiser: string;
  rows: DailyRawJsonRow[];
  /** Target date in yyyy-mm-dd. */
  targetDate: string;
  /** Day-over-day comparison date (typically targetDate - 1). */
  compareDateDoD: string;
  /** Month-over-month comparison date (typically targetDate - 30). */
  compareDateMoM: string;
}

export interface DailyDeltas {
  impressions_pct: number;
  clicks_pct: number;
  cost_pct: number;
  conversions_pct: number;
  revenue_pct: number;
  roas_pct: number;
}

export interface DailyDerivedMetrics {
  /** ROAS MoM percentage delta. null when prev ROAS undefined. */
  roas_mom_pct: number | null;
  /** CPC MoM percentage delta. null when either CPC undefined. */
  cpc_mom_pct: number | null;
  /** Impressions DoD percentage delta. null when prev impressions = 0. */
  impressions_dod_pct: number | null;
}

export interface DailyPayload {
  advertiser: string;
  target_date: string;
  compare_dod_date: string;
  compare_mom_date: string;
  kpi_target: KpiSummary;
  kpi_dod: KpiSummary;
  kpi_mom: KpiSummary;
  deltas: {
    dod_pct: DailyDeltas;
    mom_pct: DailyDeltas;
  };
  derived: DailyDerivedMetrics;
  data_warnings: string[];
}

function sumRows(rows: DailyRawJsonRow[], date: string): KpiSummary {
  const filtered = rows.filter((r) => r["날짜"] === date);
  let impressions = 0;
  let clicks = 0;
  let cost = 0;
  let conversions = 0;
  let revenue = 0;
  for (const r of filtered) {
    impressions += r["노출수"] || 0;
    clicks += r["클릭수"] || 0;
    cost += r["광고비 (VAT-)"] || 0;
    conversions +=
      (r["구매완료"] || 0) +
      (r["회원가입"] || 0) +
      (r["신청완료"] || 0) +
      (r["기타전환"] || 0);
    revenue += r["전환매출액"] || 0;
  }
  return buildKpiSummary({ impressions, clicks, cost, conversions, revenue });
}

function buildDelta(cur: KpiSummary, prev: KpiSummary): DailyDeltas {
  return {
    impressions_pct: pctDelta(cur.impressions, prev.impressions),
    clicks_pct: pctDelta(cur.clicks, prev.clicks),
    cost_pct: pctDelta(cur.cost, prev.cost),
    conversions_pct: pctDelta(cur.conversions, prev.conversions),
    revenue_pct: pctDelta(cur.revenue, prev.revenue),
    roas_pct: pctDelta(cur.roas, prev.roas),
  };
}

function cpc(kpi: KpiSummary): number | null {
  if (kpi.clicks === 0) return null;
  return kpi.cost / kpi.clicks;
}

function safePctDelta(cur: number | null, prev: number | null): number | null {
  if (cur === null || prev === null) return null;
  if (prev === 0) return null;
  return ((cur - prev) / prev) * 100;
}

function isEmpty(rows: DailyRawJsonRow[], date: string): boolean {
  return rows.every((r) => r["날짜"] !== date);
}

export function aggregateDailyPayload(args: AggregateDailyArgs): DailyPayload {
  const kpi_target = sumRows(args.rows, args.targetDate);
  const kpi_dod = sumRows(args.rows, args.compareDateDoD);
  const kpi_mom = sumRows(args.rows, args.compareDateMoM);

  const data_warnings: string[] = [];
  if (isEmpty(args.rows, args.targetDate)) {
    data_warnings.push("D-1 데이터 없음");
  }
  if (isEmpty(args.rows, args.compareDateDoD)) {
    data_warnings.push("DoD 비교 데이터 없음");
  }
  if (isEmpty(args.rows, args.compareDateMoM)) {
    data_warnings.push("MoM 비교 데이터 없음");
  }

  const targetCpc = cpc(kpi_target);
  const momCpc = cpc(kpi_mom);

  const derived: DailyDerivedMetrics = {
    roas_mom_pct:
      kpi_mom.roas === 0 ? null : pctDelta(kpi_target.roas, kpi_mom.roas),
    cpc_mom_pct: safePctDelta(targetCpc, momCpc),
    impressions_dod_pct:
      kpi_dod.impressions === 0
        ? null
        : pctDelta(kpi_target.impressions, kpi_dod.impressions),
  };

  return {
    advertiser: args.advertiser,
    target_date: args.targetDate,
    compare_dod_date: args.compareDateDoD,
    compare_mom_date: args.compareDateMoM,
    kpi_target,
    kpi_dod,
    kpi_mom,
    deltas: {
      dod_pct: buildDelta(kpi_target, kpi_dod),
      mom_pct: buildDelta(kpi_target, kpi_mom),
    },
    derived,
    data_warnings,
  };
}
