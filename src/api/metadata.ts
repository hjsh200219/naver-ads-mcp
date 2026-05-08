import type { INaverAdsClient, NaverCampaign, NaverAdGroup, NaverKeyword, NaverProductGroup } from "./types.js";

export function getCampaigns(client: INaverAdsClient): Promise<NaverCampaign[]> {
  return client.get<NaverCampaign[]>("/ncc/campaigns");
}

export function getAdGroups(
  client: INaverAdsClient,
  opts?: { campaignId?: string },
): Promise<NaverAdGroup[]> {
  return client.get<NaverAdGroup[]>(
    "/ncc/adgroups",
    opts?.campaignId ? { nccCampaignId: opts.campaignId } : undefined,
  );
}

export function getKeywords(
  client: INaverAdsClient,
  opts?: { adGroupId?: string },
): Promise<NaverKeyword[]> {
  return client.get<NaverKeyword[]>(
    "/ncc/keywords",
    opts?.adGroupId ? { nccAdgroupId: opts.adGroupId } : undefined,
  );
}

export function getProducts(client: INaverAdsClient): Promise<NaverProductGroup[]> {
  return client.get<NaverProductGroup[]>("/ncc/product-groups");
}
