import { describe, it, expect } from "vitest";
import { buildDailyRaw } from "../src/raw/daily.js";
import { buildKeywordRaw } from "../src/raw/keyword.js";
import { buildSearchTermRaw } from "../src/raw/search-term.js";
import { buildMaterialRaw } from "../src/raw/material.js";
import type { NaverCampaign, NaverAdGroup } from "../src/api/types.js";

// Minimal fixture helpers
const campaign: NaverCampaign = {
  nccCampaignId: "cmp-001",
  customerId: 1,
  name: "테스트캠페인",
  campaignTp: "WEB_SITE",
  status: "ELIGIBLE",
};

const shoppingCampaign: NaverCampaign = {
  nccCampaignId: "cmp-002",
  customerId: 1,
  name: "쇼핑캠페인",
  campaignTp: "SHOPPING",
  status: "ELIGIBLE",
};

const adGroup: NaverAdGroup = {
  nccAdgroupId: "ag-001",
  nccCampaignId: "cmp-001",
  name: "테스트광고그룹",
};

const shoppingAdGroup: NaverAdGroup = {
  nccAdgroupId: "ag-002",
  nccCampaignId: "cmp-002",
  name: "쇼핑광고그룹",
};

describe("buildDailyRaw", () => {
  it("1 op + 1 conv(구매완료) → 구매완료=5, 전환매출액=1000", async () => {
    const rows = await buildDailyRaw({
      startDate: "2026-02-06",
      endDate: "2026-02-06",
      fetched: {
        op: [{
          statDt: "2026-02-06",
          nccCampaignId: "cmp-001",
          nccAdgroupId: "ag-001",
          pcMblTp: "PC",
          salesAmt: 11000,
          impCnt: 100,
          clkCnt: 10,
          avgRnk: 1.5,
        }],
        conv: [{
          statDt: "2026-02-06",
          nccCampaignId: "cmp-001",
          nccAdgroupId: "ag-001",
          pcMblTp: "PC",
          convTpCd: 1,
          ccnt: 5,
          convAmt: 1000,
        }],
        campaigns: [campaign],
        adGroups: [adGroup],
      },
    });
    expect(rows).toHaveLength(1);
    expect(rows[0].구매완료).toBe(5);
    expect(rows[0].전환매출액).toBe(1000);
  });

  it("VAT included: salesAmt=110 → 광고비(VAT-)=100", async () => {
    const rows = await buildDailyRaw({
      startDate: "2026-02-06",
      endDate: "2026-02-06",
      config: { vatIncluded: true },
      fetched: {
        op: [{
          statDt: "2026-02-06",
          nccCampaignId: "cmp-001",
          nccAdgroupId: "ag-001",
          pcMblTp: "PC",
          salesAmt: 110,
        }],
        conv: [],
        campaigns: [campaign],
        adGroups: [adGroup],
      },
    });
    expect(rows[0]["광고비 (VAT-)"]).toBe(100);
  });

  it("VAT off: salesAmt=110 → 광고비=110", async () => {
    const rows = await buildDailyRaw({
      startDate: "2026-02-06",
      endDate: "2026-02-06",
      config: { vatIncluded: false },
      fetched: {
        op: [{
          statDt: "2026-02-06",
          nccCampaignId: "cmp-001",
          nccAdgroupId: "ag-001",
          pcMblTp: "PC",
          salesAmt: 110,
        }],
        conv: [],
        campaigns: [campaign],
        adGroups: [adGroup],
      },
    });
    expect(rows[0]["광고비 (VAT-)"]).toBe(110);
  });

  it("multiple conv rows for same group sum into right cols", async () => {
    const rows = await buildDailyRaw({
      startDate: "2026-02-06",
      endDate: "2026-02-06",
      fetched: {
        op: [{
          statDt: "2026-02-06",
          nccCampaignId: "cmp-001",
          nccAdgroupId: "ag-001",
          pcMblTp: "PC",
          salesAmt: 0,
        }],
        conv: [
          {
            statDt: "2026-02-06",
            nccCampaignId: "cmp-001",
            nccAdgroupId: "ag-001",
            pcMblTp: "PC",
            convTpCd: 1,
            ccnt: 3,
            convAmt: 300,
          },
          {
            statDt: "2026-02-06",
            nccCampaignId: "cmp-001",
            nccAdgroupId: "ag-001",
            pcMblTp: "PC",
            convTpCd: 2,
            ccnt: 7,
            convAmt: 700,
          },
        ],
        campaigns: [campaign],
        adGroups: [adGroup],
      },
    });
    expect(rows[0].구매완료).toBe(3);
    expect(rows[0].회원가입).toBe(7);
    expect(rows[0].전환매출액).toBe(1000);
  });

  it("unknown convTpCd (99) → 기타전환", async () => {
    const rows = await buildDailyRaw({
      startDate: "2026-02-06",
      endDate: "2026-02-06",
      fetched: {
        op: [{
          statDt: "2026-02-06",
          nccCampaignId: "cmp-001",
          nccAdgroupId: "ag-001",
          pcMblTp: "PC",
          salesAmt: 0,
        }],
        conv: [{
          statDt: "2026-02-06",
          nccCampaignId: "cmp-001",
          nccAdgroupId: "ag-001",
          pcMblTp: "PC",
          convTpCd: 99,
          ccnt: 4,
          convAmt: 0,
        }],
        campaigns: [campaign],
        adGroups: [adGroup],
      },
    });
    expect(rows[0].기타전환).toBe(4);
    expect(rows[0].구매완료).toBe(0);
  });

  it("월별/주차 derivation: 2026-02-06 → 2026-02, 2026-02-02주차", async () => {
    const rows = await buildDailyRaw({
      startDate: "2026-02-06",
      endDate: "2026-02-06",
      fetched: {
        op: [{
          statDt: "2026-02-06",
          nccCampaignId: "cmp-001",
          nccAdgroupId: "ag-001",
          pcMblTp: "PC",
          salesAmt: 0,
        }],
        conv: [],
        campaigns: [campaign],
        adGroups: [adGroup],
      },
    });
    expect(rows[0].월별).toBe("2026-02");
    expect(rows[0].주차).toBe("2026-02-02주차");
    expect(rows[0].날짜).toBe("2026-02-06");
  });

  it("디바이스 M → MO normalization", async () => {
    const rows = await buildDailyRaw({
      startDate: "2026-02-06",
      endDate: "2026-02-06",
      fetched: {
        op: [{
          statDt: "2026-02-06",
          nccCampaignId: "cmp-001",
          nccAdgroupId: "ag-001",
          pcMblTp: "M",
          salesAmt: 0,
        }],
        conv: [],
        campaigns: [campaign],
        adGroups: [adGroup],
      },
    });
    expect(rows[0].디바이스).toBe("MO");
  });

  it("디바이스 PC stays PC", async () => {
    const rows = await buildDailyRaw({
      startDate: "2026-02-06",
      endDate: "2026-02-06",
      fetched: {
        op: [{
          statDt: "2026-02-06",
          nccCampaignId: "cmp-001",
          nccAdgroupId: "ag-001",
          pcMblTp: "PC",
          salesAmt: 0,
        }],
        conv: [],
        campaigns: [campaign],
        adGroups: [adGroup],
      },
    });
    expect(rows[0].디바이스).toBe("PC");
  });

  it("campaignTp WEB_SITE → 캠페인유형=파워링크", async () => {
    const rows = await buildDailyRaw({
      startDate: "2026-02-06",
      endDate: "2026-02-06",
      fetched: {
        op: [{
          statDt: "2026-02-06",
          nccCampaignId: "cmp-001",
          nccAdgroupId: "ag-001",
          pcMblTp: "PC",
          salesAmt: 0,
        }],
        conv: [],
        campaigns: [campaign],
        adGroups: [adGroup],
      },
    });
    expect(rows[0].캠페인유형).toBe("파워링크");
  });

  it("missing campaign metadata → fallback to campaignId", async () => {
    const rows = await buildDailyRaw({
      startDate: "2026-02-06",
      endDate: "2026-02-06",
      fetched: {
        op: [{
          statDt: "2026-02-06",
          nccCampaignId: "unknown-cmp",
          nccAdgroupId: "unknown-ag",
          pcMblTp: "PC",
          salesAmt: 0,
        }],
        conv: [],
        campaigns: [],
        adGroups: [],
      },
    });
    expect(rows[0].캠페인).toBe("unknown-cmp");
    expect(rows[0].광고그룹).toBe("unknown-ag");
  });

  it("empty op array → empty result", async () => {
    const rows = await buildDailyRaw({
      startDate: "2026-02-06",
      endDate: "2026-02-06",
      fetched: {
        op: [],
        conv: [],
        campaigns: [campaign],
        adGroups: [adGroup],
      },
    });
    expect(rows).toHaveLength(0);
  });
});

describe("buildKeywordRaw", () => {
  it("includes 키워드 column from o.keyword", async () => {
    const rows = await buildKeywordRaw({
      startDate: "2026-02-06",
      endDate: "2026-02-06",
      fetched: {
        op: [{
          statDt: "2026-02-06",
          nccCampaignId: "cmp-001",
          nccAdgroupId: "ag-001",
          pcMblTp: "PC",
          salesAmt: 0,
          keyword: "노트북",
          nccKeywordId: "kw-001",
        }],
        conv: [],
        campaigns: [campaign],
        adGroups: [adGroup],
      },
    });
    expect(rows).toHaveLength(1);
    expect(rows[0].키워드).toBe("노트북");
  });

  it("키워드 fallback to kwMap when o.keyword missing", async () => {
    const rows = await buildKeywordRaw({
      startDate: "2026-02-06",
      endDate: "2026-02-06",
      fetched: {
        op: [{
          statDt: "2026-02-06",
          nccCampaignId: "cmp-001",
          nccAdgroupId: "ag-001",
          pcMblTp: "PC",
          salesAmt: 0,
          nccKeywordId: "kw-001",
        }],
        conv: [],
        campaigns: [campaign],
        adGroups: [adGroup],
        keywords: [{ nccKeywordId: "kw-001", nccAdgroupId: "ag-001", keyword: "키보드" }],
      },
    });
    expect(rows[0].키워드).toBe("키보드");
  });
});

describe("buildSearchTermRaw", () => {
  it("includes 검색어 column from o.searchTerm", async () => {
    const rows = await buildSearchTermRaw({
      startDate: "2026-02-06",
      endDate: "2026-02-06",
      fetched: {
        op: [{
          statDt: "2026-02-06",
          nccCampaignId: "cmp-001",
          nccAdgroupId: "ag-001",
          pcMblTp: "PC",
          salesAmt: 0,
          searchTerm: "삼성 노트북",
        }],
        conv: [],
        campaigns: [campaign],
        adGroups: [adGroup],
      },
    });
    expect(rows).toHaveLength(1);
    expect(rows[0].검색어).toBe("삼성 노트북");
  });
});

describe("buildMaterialRaw", () => {
  it("includes 소재ID, 네이버 쇼핑 상품 ID, 상품명", async () => {
    const rows = await buildMaterialRaw({
      startDate: "2026-02-06",
      endDate: "2026-02-06",
      fetched: {
        op: [{
          statDt: "2026-02-06",
          nccCampaignId: "cmp-002",
          nccAdgroupId: "ag-002",
          pcMblTp: "PC",
          salesAmt: 0,
          nccAdId: "ad-001",
          productId: "prod-001",
          productName: "삼성 갤럭시북",
        }],
        conv: [],
        campaigns: [shoppingCampaign],
        adGroups: [shoppingAdGroup],
      },
    });
    expect(rows).toHaveLength(1);
    expect(rows[0].소재ID).toBe("ad-001");
    expect(rows[0]["네이버 쇼핑 상품 ID"]).toBe("prod-001");
    expect(rows[0].상품명).toBe("삼성 갤럭시북");
  });

  it("product name from productNameMap when o.productName missing", async () => {
    const rows = await buildMaterialRaw({
      startDate: "2026-02-06",
      endDate: "2026-02-06",
      fetched: {
        op: [{
          statDt: "2026-02-06",
          nccCampaignId: "cmp-002",
          nccAdgroupId: "ag-002",
          pcMblTp: "PC",
          salesAmt: 0,
          nccAdId: "ad-002",
          productId: "prod-002",
        }],
        conv: [],
        campaigns: [shoppingCampaign],
        adGroups: [shoppingAdGroup],
        products: [{
          nccProductGroupId: "pg-001",
          nccCampaignId: "cmp-002",
          name: "상품그룹1",
          productList: [{ productId: "prod-002", productName: "LG 그램" }],
        }],
      },
    });
    expect(rows[0].상품명).toBe("LG 그램");
  });

  it("empty op → empty result", async () => {
    const rows = await buildMaterialRaw({
      startDate: "2026-02-06",
      endDate: "2026-02-06",
      fetched: {
        op: [],
        conv: [],
        campaigns: [],
        adGroups: [],
      },
    });
    expect(rows).toHaveLength(0);
  });
});
