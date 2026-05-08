import type { MaterialRawRow } from "../raw/builder.js";
import type { ProductPivot } from "./types.js";
import { groupAggregate, deriveMetrics } from "./aggregate.js";

export function buildProductPerformance(rows: MaterialRawRow[]): ProductPivot {
  const map = groupAggregate(
    rows,
    (r) => `${r["네이버 쇼핑 상품 ID"]}__${r.상품명}`,
  );
  const meta = new Map<string, { productId: string; productName: string }>();
  for (const r of rows) {
    const key = `${r["네이버 쇼핑 상품 ID"]}__${r.상품명}`;
    if (!meta.has(key)) {
      meta.set(key, {
        productId: r["네이버 쇼핑 상품 ID"],
        productName: r.상품명,
      });
    }
  }
  const items = Array.from(map.entries()).map(([key, bucket]) => {
    const m = meta.get(key)!;
    return {
      label: m.productId,
      productId: m.productId,
      productName: m.productName,
      metrics: deriveMetrics(bucket),
    };
  });
  return { items };
}
