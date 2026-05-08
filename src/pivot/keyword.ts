import type { KeywordRawRow } from "../raw/builder.js";
import type { ListPivot } from "./types.js";
import { groupAggregate, deriveMetrics } from "./aggregate.js";

export function buildKeywordPerformance(rows: KeywordRawRow[]): ListPivot {
  const map = groupAggregate(rows, (r) => r.키워드);
  const items = Array.from(map.entries())
    .map(([label, bucket]) => ({ label, metrics: deriveMetrics(bucket) }))
    .sort((a, b) => b.metrics.광고비 - a.metrics.광고비);
  return { items };
}
