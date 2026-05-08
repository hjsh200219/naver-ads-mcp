import type { RawRowBase } from "../raw/builder.js";

export function safeDiv(a: number, b: number): number {
  return b === 0 ? 0 : a / b;
}

/** Weighted average rank by impressions */
export function weightedAvgRank(rows: { 노출수: number; 평균노출순위: number }[]): number {
  let totImp = 0;
  let weighted = 0;
  for (const r of rows) {
    totImp += r.노출수;
    weighted += r.노출수 * r.평균노출순위;
  }
  return totImp === 0 ? 0 : weighted / totImp;
}

export interface AggregateBucket {
  광고비: number;
  노출수: number;
  클릭수: number;
  신청완료: number;
  ranks: { 노출수: number; 평균노출순위: number }[];
}

/** Aggregate any array of RawRow-compatible records by key extractor. Returns Map<key, bucket>. */
export function groupAggregate<T extends RawRowBase, K>(
  rows: T[],
  keyFn: (r: T) => K,
): Map<K, AggregateBucket> {
  const m = new Map<K, AggregateBucket>();
  for (const r of rows) {
    const k = keyFn(r);
    let bucket = m.get(k);
    if (!bucket) {
      bucket = { 광고비: 0, 노출수: 0, 클릭수: 0, 신청완료: 0, ranks: [] };
      m.set(k, bucket);
    }
    bucket.광고비 += r["광고비 (VAT-)"];
    bucket.노출수 += r.노출수;
    bucket.클릭수 += r.클릭수;
    bucket.신청완료 += r.신청완료;
    bucket.ranks.push({ 노출수: r.노출수, 평균노출순위: r.평균노출순위 });
  }
  return m;
}

/** Convert an AggregateBucket into derived metrics */
export function deriveMetrics(b: AggregateBucket) {
  return {
    광고비: b.광고비,
    노출수: b.노출수,
    클릭수: b.클릭수,
    CTR: safeDiv(b.클릭수, b.노출수),
    CPC: safeDiv(b.광고비, b.클릭수),
    신청완료: b.신청완료,
    신청완료CVR: safeDiv(b.신청완료, b.클릭수),
    신청완료CPA: safeDiv(b.광고비, b.신청완료),
    평균노출순위: weightedAvgRank(b.ranks),
  };
}
