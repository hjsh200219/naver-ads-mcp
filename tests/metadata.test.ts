import { describe, it, expect, vi } from "vitest";
import type { INaverAdsClient } from "../src/api/types.js";
import { getCampaigns, getAdGroups, getKeywords, getProducts } from "../src/api/metadata.js";
import type { NaverCampaign, NaverAdGroup, NaverKeyword, NaverProductGroup } from "../src/api/types.js";

function makeMockClient(responses: Record<string, unknown>): INaverAdsClient {
  return {
    get: vi.fn(async (path: string) => responses[path]),
    post: vi.fn(async () => {
      throw new Error("not used");
    }),
  };
}

const MOCK_CAMPAIGNS: NaverCampaign[] = [
  { nccCampaignId: "cmp-1", customerId: 42, name: "Test Campaign", campaignTp: "WEB_SITE", status: "ELIGIBLE" },
];

const MOCK_ADGROUPS: NaverAdGroup[] = [
  { nccAdgroupId: "adg-1", nccCampaignId: "cmp-1", name: "AdGroup A" },
];

const MOCK_KEYWORDS: NaverKeyword[] = [
  { nccKeywordId: "kwd-1", nccAdgroupId: "adg-1", keyword: "브랜드명", bidAmt: 100 },
];

const MOCK_PRODUCTS: NaverProductGroup[] = [
  {
    nccProductGroupId: "pg-1",
    nccCampaignId: "cmp-1",
    name: "Product Group A",
    productList: [{ productId: "p-1", productName: "Widget" }],
  },
];

describe("US-006 getCampaigns()", () => {
  it("calls client.get with /ncc/campaigns", async () => {
    const client = makeMockClient({ "/ncc/campaigns": MOCK_CAMPAIGNS });
    await getCampaigns(client);
    expect(client.get).toHaveBeenCalledWith("/ncc/campaigns");
  });

  it("returns NaverCampaign[] with expected shape", async () => {
    const client = makeMockClient({ "/ncc/campaigns": MOCK_CAMPAIGNS });
    const result = await getCampaigns(client);
    expect(Array.isArray(result)).toBe(true);
    const first = result[0];
    expect(first).toBeDefined();
    expect(typeof first!.nccCampaignId).toBe("string");
    expect(typeof first!.customerId).toBe("number");
    expect(typeof first!.name).toBe("string");
    expect(first!.campaignTp).toBe("WEB_SITE");
    expect(first!.status).toBe("ELIGIBLE");
  });
});

describe("US-006 getAdGroups()", () => {
  it("calls client.get with /ncc/adgroups and nccCampaignId when campaignId provided", async () => {
    const client = makeMockClient({ "/ncc/adgroups": MOCK_ADGROUPS });
    await getAdGroups(client, { campaignId: "cmp-1" });
    expect(client.get).toHaveBeenCalledWith("/ncc/adgroups", { nccCampaignId: "cmp-1" });
  });

  it("calls client.get with /ncc/adgroups and no query when campaignId omitted", async () => {
    const client = makeMockClient({ "/ncc/adgroups": MOCK_ADGROUPS });
    await getAdGroups(client);
    expect(client.get).toHaveBeenCalledWith("/ncc/adgroups", undefined);
  });

  it("returns NaverAdGroup[] with expected shape", async () => {
    const client = makeMockClient({ "/ncc/adgroups": MOCK_ADGROUPS });
    const result = await getAdGroups(client, { campaignId: "cmp-1" });
    expect(Array.isArray(result)).toBe(true);
    const first = result[0];
    expect(first).toBeDefined();
    expect(first!.nccAdgroupId).toBe("adg-1");
    expect(first!.nccCampaignId).toBe("cmp-1");
  });
});

describe("US-006 getKeywords()", () => {
  it("calls client.get with /ncc/keywords and nccAdgroupId when adGroupId provided", async () => {
    const client = makeMockClient({ "/ncc/keywords": MOCK_KEYWORDS });
    await getKeywords(client, { adGroupId: "adg-1" });
    expect(client.get).toHaveBeenCalledWith("/ncc/keywords", { nccAdgroupId: "adg-1" });
  });

  it("returns NaverKeyword[] with expected shape", async () => {
    const client = makeMockClient({ "/ncc/keywords": MOCK_KEYWORDS });
    const result = await getKeywords(client, { adGroupId: "adg-1" });
    expect(Array.isArray(result)).toBe(true);
    const first = result[0];
    expect(first).toBeDefined();
    expect(first!.nccKeywordId).toBe("kwd-1");
    expect(first!.keyword).toBe("브랜드명");
    expect(first!.bidAmt).toBe(100);
  });
});

describe("US-006 getProducts()", () => {
  it("calls client.get with /ncc/product-groups", async () => {
    const client = makeMockClient({ "/ncc/product-groups": MOCK_PRODUCTS });
    await getProducts(client);
    expect(client.get).toHaveBeenCalledWith("/ncc/product-groups");
  });

  it("returns NaverProductGroup[] with expected shape", async () => {
    const client = makeMockClient({ "/ncc/product-groups": MOCK_PRODUCTS });
    const result = await getProducts(client);
    expect(Array.isArray(result)).toBe(true);
    const first = result[0];
    expect(first).toBeDefined();
    expect(first!.nccProductGroupId).toBe("pg-1");
    expect(first!.name).toBe("Product Group A");
    expect(first!.productList).toHaveLength(1);
    expect(first!.productList![0]!.productId).toBe("p-1");
  });
});
