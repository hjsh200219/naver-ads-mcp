import type { KeywordRawRow } from "../raw/builder.js";
import type { PivotCell, PivotSheet } from "./types.js";
import { groupAggregate, deriveMetrics } from "./aggregate.js";

const HEADER: PivotCell[] = [
  { value: "키워드" },
  { value: "광고비(VAT-)", format: "currency" },
  { value: "노출수", format: "integer" },
  { value: "클릭수", format: "integer" },
  { value: "CTR", format: "percent" },
  { value: "CPC", format: "currency" },
  { value: "신청완료", format: "integer" },
  { value: "신청완료CVR", format: "percent" },
  { value: "신청완료CPA", format: "currency" },
  { value: "평균노출순위", format: "decimal" },
];

export function buildKeywordPerformance(rows: KeywordRawRow[]): PivotSheet {
  const byKeyword = groupAggregate(rows, (r) => r.키워드);

  const sorted = Array.from(byKeyword.entries()).sort(
    ([, a], [, b]) => b.광고비 - a.광고비,
  );

  const dataRows: PivotCell[][] = sorted.map(([keyword, bucket]) => {
    const m = deriveMetrics(bucket);
    return [
      { value: keyword },
      { value: m.광고비, format: "currency" },
      { value: m.노출수, format: "integer" },
      { value: m.클릭수, format: "integer" },
      { value: m.CTR, format: "percent" },
      { value: m.CPC, format: "currency" },
      { value: m.신청완료, format: "integer" },
      { value: m.신청완료CVR, format: "percent" },
      { value: m.신청완료CPA, format: "currency" },
      { value: m.평균노출순위, format: "decimal" },
    ];
  });

  return {
    title: "키워드성과",
    rows: [HEADER, ...dataRows],
  };
}
