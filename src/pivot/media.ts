import type { RawRowBase } from "../raw/builder.js";
import type { PivotCell, PivotSheet } from "./types.js";
import { groupAggregate, deriveMetrics } from "./aggregate.js";

const HEADER: PivotCell[] = [
  { value: "구분" },
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

function metricsToRow(label: string, m: ReturnType<typeof deriveMetrics>): PivotCell[] {
  return [
    { value: label },
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
}

export function buildMediaPerformance<T extends RawRowBase>(rows: T[]): PivotSheet {
  const BLANK_ROW: PivotCell[] = [{ value: null }];

  // Monthly section
  const byMonth = groupAggregate(rows, (r) => r.월별);
  const monthKeys = Array.from(byMonth.keys()).sort();
  const monthlyRows: PivotCell[][] = [
    [{ value: "월별 성과" }],
    HEADER,
    ...monthKeys.map((k) => metricsToRow(k, deriveMetrics(byMonth.get(k)!))),
  ];

  // Weekly section
  const byWeek = groupAggregate(rows, (r) => r.주차);
  const weekKeys = Array.from(byWeek.keys()).sort();
  const weeklyRows: PivotCell[][] = [
    [{ value: "주차별 성과" }],
    HEADER,
    ...weekKeys.map((k) => metricsToRow(k, deriveMetrics(byWeek.get(k)!))),
  ];

  return {
    title: "매체별성과",
    rows: [...monthlyRows, BLANK_ROW, ...weeklyRows],
    hidden: rows.length === 0,
  };
}
