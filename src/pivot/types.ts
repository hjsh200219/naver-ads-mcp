export interface PivotCell {
  value: string | number | null;
  format?: "currency" | "integer" | "percent" | "decimal";
}

export interface PivotSheet {
  title: string;
  rows: PivotCell[][];
  hidden?: boolean;
}

export interface AggregatedRow {
  광고비: number;
  노출수: number;
  클릭수: number;
  CTR: number;
  CPC: number;
  신청완료: number;
  신청완료CVR: number;
  신청완료CPA: number;
  평균노출순위: number;
}
