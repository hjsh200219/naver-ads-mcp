import type { RawRowBase } from "../raw/builder.js";
import type { PivotCell, PivotSheet } from "./types.js";
import { groupAggregate, deriveMetrics } from "./aggregate.js";

const HEADER: PivotCell[] = [
  { value: "매체" },
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

export function buildSummary<T extends RawRowBase>(rows: T[]): PivotSheet {
  const byMedia = groupAggregate(rows, (r) => r.매체);
  const dataRows: PivotCell[][] = [];

  for (const [media, bucket] of byMedia) {
    dataRows.push(metricsToRow(media, deriveMetrics(bucket)));
  }

  // Total row: aggregate all rows
  const totalBucket = {
    광고비: rows.reduce((s, r) => s + r["광고비 (VAT-)"], 0),
    노출수: rows.reduce((s, r) => s + r.노출수, 0),
    클릭수: rows.reduce((s, r) => s + r.클릭수, 0),
    신청완료: rows.reduce((s, r) => s + r.신청완료, 0),
    ranks: rows.map((r) => ({ 노출수: r.노출수, 평균노출순위: r.평균노출순위 })),
  };

  const totalRow = metricsToRow("총합계", deriveMetrics(totalBucket));

  return {
    title: "SUMMARY",
    rows: [HEADER, ...dataRows, totalRow],
    hidden: false,
  };
}
