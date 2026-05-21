// Public Naver Search Ad API response shapes (subset — fields actually consumed)

export interface NaverCampaign {
  nccCampaignId: string;
  customerId: number;
  name: string;
  campaignTp:
    | "WEB_SITE"
    | "SHOPPING"
    | "BRAND_SEARCH"
    | "POWER_CONTENTS"
    | string;
  status: string;
}

export interface NaverAdGroup {
  nccAdgroupId: string;
  nccCampaignId: string;
  name: string;
  pcChannelId?: string;
  mobileChannelId?: string;
}

export interface NaverKeyword {
  nccKeywordId: string;
  nccAdgroupId: string;
  keyword: string;
  bidAmt?: number;
}

export interface NaverProductGroup {
  nccProductGroupId: string;
  nccCampaignId: string;
  name: string;
  productList?: Array<{ productId: string; productName: string }>;
}

// Client interface — implemented by NaverAdsClient in client.ts
export interface INaverAdsClient {
  get<T>(
    path: string,
    query?: Record<string, string | number | undefined>,
  ): Promise<T>;
  post<T>(path: string, body: unknown): Promise<T>;
  // Signed GET for absolute URLs returning binary payloads (e.g. stat-report
  // downloads). Signs using the URL's path-only, matching Naver's payload spec.
  downloadBinary(absoluteUrl: string): Promise<Buffer>;
}
