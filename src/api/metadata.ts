import type {
  INaverAdsClient,
  NaverCampaign,
  NaverAdGroup,
  NaverKeyword,
  NaverProductGroup,
} from "./types.js";

export function getCampaigns(
  client: INaverAdsClient,
): Promise<NaverCampaign[]> {
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
  opts: { adGroupId: string },
): Promise<NaverKeyword[]> {
  return client.get<NaverKeyword[]>("/ncc/keywords", {
    nccAdgroupId: opts.adGroupId,
  });
}

// Naver `/ncc/keywords` requires `nccAdgroupId`; iterate ad groups to collect all.
export async function getAllKeywords(
  client: INaverAdsClient,
  adGroups: ReadonlyArray<Pick<NaverAdGroup, "nccAdgroupId">>,
): Promise<NaverKeyword[]> {
  const results = await Promise.all(
    adGroups.map((ag) => getKeywords(client, { adGroupId: ag.nccAdgroupId })),
  );
  return results.flat();
}

export function getProducts(
  client: INaverAdsClient,
): Promise<NaverProductGroup[]> {
  return client.get<NaverProductGroup[]>("/ncc/product-groups");
}
