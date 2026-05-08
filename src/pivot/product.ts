import type { MaterialRawRow } from "../raw/builder.js";
import type { PivotCell, PivotSheet } from "./types.js";
import { groupAggregate, deriveMetrics } from "./aggregate.js";

const HEADER: PivotCell[] = [
  { value: "상품ID" },
  { value: "상품명" },
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

export function buildProductPerformance(rows: MaterialRawRow[]): PivotSheet {
  const byProduct = groupAggregate(
    rows,
    (r) => `${r["네이버 쇼핑 상품 ID"]}__${r.상품명}`,
  );

  // Also track productId and productName per key
  const metaMap = new Map<string, { productId: string; productName: string }>();
  for (const r of rows) {
    const key = `${r["네이버 쇼핑 상품 ID"]}__${r.상품명}`;
    if (!metaMap.has(key)) {
      metaMap.set(key, {
        productId: r["네이버 쇼핑 상품 ID"],
        productName: r.상품명,
      });
    }
  }

  const dataRows: PivotCell[][] = Array.from(byProduct.entries()).map(([key, bucket]) => {
    const m = deriveMetrics(bucket);
    const meta = metaMap.get(key)!;
    return [
      { value: meta.productId },
      { value: meta.productName },
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
    title: "상품성과",
    rows: [HEADER, ...dataRows],
  };
}
