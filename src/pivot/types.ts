// Structured pivot output. Layout/styling lives in the writer; these types
// only describe aggregated metric data.

export interface PivotMetrics {
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

export interface MetricsGroup {
  label: string;
  metrics: PivotMetrics;
}

export interface ProductMetricsGroup extends MetricsGroup {
  productId: string;
  productName: string;
}

export interface SummaryPivot {
  byMedia: MetricsGroup[];
  byCampaignType: MetricsGroup[];
  byDevice: MetricsGroup[];
  total: PivotMetrics;
}

export interface MediaPivot {
  monthly: MetricsGroup[];
  weekly: MetricsGroup[];
  daily: MetricsGroup[];
  hidden: boolean;
}

export interface ListPivot {
  items: MetricsGroup[];
}

export interface ProductPivot {
  items: ProductMetricsGroup[];
}

// Brand search uses static rows and is hidden by default.
export interface BrandSearchPivot {
  /** Reserved for future API support. Currently unused. */
  areas?: never;
}
