import type { RawRowBase } from "../raw/builder.js";
import type { MetricsGroup, PivotMetrics, SummaryPivot } from "./types.js";
import { groupAggregate, deriveMetrics } from "./aggregate.js";

function toGroup(label: string, metrics: PivotMetrics): MetricsGroup {
  return { label, metrics };
}

function aggregateAll<T extends RawRowBase>(rows: T[]): PivotMetrics {
  return deriveMetrics({
    광고비: rows.reduce((s, r) => s + r["광고비 (VAT-)"], 0),
    노출수: rows.reduce((s, r) => s + r.노출수, 0),
    클릭수: rows.reduce((s, r) => s + r.클릭수, 0),
    신청완료: rows.reduce((s, r) => s + r.신청완료, 0),
    ranks: rows.map((r) => ({
      노출수: r.노출수,
      평균노출순위: r.평균노출순위,
    })),
  });
}

function groupByKey<T extends RawRowBase>(
  rows: T[],
  keyFn: (r: T) => string,
): MetricsGroup[] {
  const map = groupAggregate(rows, keyFn);
  return Array.from(map.entries())
    .map(([label, bucket]) => toGroup(label, deriveMetrics(bucket)))
    .sort((a, b) => a.label.localeCompare(b.label));
}

export function buildSummary<T extends RawRowBase>(rows: T[]): SummaryPivot {
  return {
    byMedia: groupByKey(rows, (r) => r.매체),
    byCampaignType: groupByKey(rows, (r) => r.캠페인유형),
    byDevice: groupByKey(rows, (r) => r.디바이스),
    total: aggregateAll(rows),
  };
}
