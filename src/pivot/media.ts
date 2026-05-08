import type { RawRowBase } from "../raw/builder.js";
import type { MediaPivot, MetricsGroup } from "./types.js";
import { groupAggregate, deriveMetrics } from "./aggregate.js";

function bucketsToGroups<T extends RawRowBase>(
  rows: T[],
  keyFn: (r: T) => string,
): MetricsGroup[] {
  const map = groupAggregate(rows, keyFn);
  return Array.from(map.entries())
    .map(([label, bucket]) => ({ label, metrics: deriveMetrics(bucket) }))
    .sort((a, b) => a.label.localeCompare(b.label));
}

export function buildMediaPerformance<T extends RawRowBase>(
  rows: T[],
): MediaPivot {
  return {
    monthly: bucketsToGroups(rows, (r) => r.월별),
    weekly: bucketsToGroups(rows, (r) => r.주차),
    daily: bucketsToGroups(rows, (r) => r.날짜),
    hidden: rows.length === 0,
  };
}
