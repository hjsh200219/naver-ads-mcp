import type { SearchTermRawRow } from "../raw/builder.js";
import type { ListPivot } from "./types.js";
import { groupAggregate, deriveMetrics } from "./aggregate.js";

export function buildSearchTermPerformance(
  rows: SearchTermRawRow[],
): ListPivot {
  // Reference filters to terms with at least 1 conversion.
  const filtered = rows.filter((r) => r.신청완료 >= 1);
  const map = groupAggregate(filtered, (r) => r.검색어);
  const items = Array.from(map.entries())
    .map(([label, bucket]) => ({ label, metrics: deriveMetrics(bucket) }))
    .sort((a, b) => b.metrics.광고비 - a.metrics.광고비);
  return { items };
}
