import { describe, it, expect } from "vitest";
import {
  safeDiv,
  weightedAvgRank,
  groupAggregate,
} from "../src/pivot/aggregate.js";
import { buildSummary } from "../src/pivot/summary.js";
import { buildMediaPerformance } from "../src/pivot/media.js";
import { buildKeywordPerformance } from "../src/pivot/keyword.js";
import { buildProductPerformance } from "../src/pivot/product.js";
import { buildSearchTermPerformance } from "../src/pivot/search-term.js";
import type {
  DailyRawRow,
  KeywordRawRow,
  SearchTermRawRow,
  MaterialRawRow,
} from "../src/raw/builder.js";

function baseRow(overrides: Partial<DailyRawRow> = {}): DailyRawRow {
  return {
    월별: "2026-02",
    주차: "2026-02-01주차",
    날짜: "2026-02-03",
    매체: "네이버",
    캠페인유형: "파워링크",
    캠페인: "캠페인A",
    광고그룹: "그룹A",
    디바이스: "PC",
    "광고비 (VAT-)": 10000,
    노출수: 1000,
    클릭수: 100,
    구매완료: 0,
    회원가입: 0,
    신청완료: 5,
    기타전환: 0,
    전환매출액: 0,
    평균노출순위: 2.0,
    ...overrides,
  };
}

describe("safeDiv", () => {
  it("safeDiv(10, 0) === 0", () => {
    expect(safeDiv(10, 0)).toBe(0);
  });
  it("safeDiv(10, 2) === 5", () => {
    expect(safeDiv(10, 2)).toBe(5);
  });
});

describe("weightedAvgRank", () => {
  it("returns 0 when all impressions are 0", () => {
    expect(weightedAvgRank([{ 노출수: 0, 평균노출순위: 3 }])).toBe(0);
  });
  it("returns weighted average by impressions", () => {
    const result = weightedAvgRank([
      { 노출수: 100, 평균노출순위: 1.0 },
      { 노출수: 300, 평균노출순위: 3.0 },
    ]);
    expect(result).toBeCloseTo(2.5);
  });
});

describe("groupAggregate", () => {
  it("sums 광고비, 노출수, 클릭수, 신청완료 for same key", () => {
    const rows = [
      baseRow({ "광고비 (VAT-)": 5000, 노출수: 200, 클릭수: 20, 신청완료: 2 }),
      baseRow({ "광고비 (VAT-)": 3000, 노출수: 100, 클릭수: 10, 신청완료: 1 }),
    ];
    const map = groupAggregate(rows, (r) => r.캠페인);
    const bucket = map.get("캠페인A")!;
    expect(bucket.광고비).toBe(8000);
    expect(bucket.노출수).toBe(300);
    expect(bucket.클릭수).toBe(30);
    expect(bucket.신청완료).toBe(3);
  });

  it("separates rows by different keys", () => {
    const rows = [baseRow({ 캠페인: "A" }), baseRow({ 캠페인: "B" })];
    const map = groupAggregate(rows, (r) => r.캠페인);
    expect(map.size).toBe(2);
  });
});

describe("buildSummary", () => {
  it("empty input → empty group arrays + zero total", () => {
    const pivot = buildSummary([]);
    expect(pivot.byMedia).toEqual([]);
    expect(pivot.byCampaignType).toEqual([]);
    expect(pivot.byDevice).toEqual([]);
    expect(pivot.total.광고비).toBe(0);
    expect(pivot.total.클릭수).toBe(0);
  });

  it("2 rows from same media+campaign+device aggregated correctly", () => {
    const rows = [
      baseRow({ "광고비 (VAT-)": 5000, 노출수: 200, 클릭수: 20, 신청완료: 2 }),
      baseRow({ "광고비 (VAT-)": 3000, 노출수: 100, 클릭수: 10, 신청완료: 1 }),
    ];
    const pivot = buildSummary(rows);
    expect(pivot.byMedia).toHaveLength(1);
    const mediaRow = pivot.byMedia[0]!;
    expect(mediaRow.label).toBe("네이버");
    expect(mediaRow.metrics.광고비).toBe(8000);
    expect(mediaRow.metrics.클릭수).toBe(30);
    expect(pivot.total.광고비).toBe(8000);
  });

  it("CTR computation: 20 clicks / 300 impressions", () => {
    const rows = [baseRow({ 노출수: 300, 클릭수: 20 })];
    const pivot = buildSummary(rows);
    expect(pivot.byMedia[0]!.metrics.CTR).toBeCloseTo(20 / 300);
  });

  it("CPA on zero-conversion row → 0", () => {
    const rows = [baseRow({ 신청완료: 0 })];
    const pivot = buildSummary(rows);
    expect(pivot.byMedia[0]!.metrics.신청완료CPA).toBe(0);
  });
});

describe("buildMediaPerformance", () => {
  it("produces monthly, weekly, daily groups", () => {
    const rows = [
      baseRow({ 월별: "2026-02", 주차: "2026-02-01주차", 날짜: "2026-02-03" }),
      baseRow({ 월별: "2026-03", 주차: "2026-03-01주차", 날짜: "2026-03-02" }),
    ];
    const pivot = buildMediaPerformance(rows);
    expect(pivot.monthly).toHaveLength(2);
    expect(pivot.weekly).toHaveLength(2);
    expect(pivot.daily).toHaveLength(2);
    expect(pivot.hidden).toBe(false);
  });

  it("hidden=true when rows empty", () => {
    expect(buildMediaPerformance([]).hidden).toBe(true);
  });

  it("monthly groups sort alphabetically by label", () => {
    const rows = [baseRow({ 월별: "2026-03" }), baseRow({ 월별: "2026-02" })];
    const pivot = buildMediaPerformance(rows);
    expect(pivot.monthly[0]!.label).toBe("2026-02");
    expect(pivot.monthly[1]!.label).toBe("2026-03");
  });
});

describe("buildKeywordPerformance", () => {
  it("sorts DESC by 광고비", () => {
    const rows: KeywordRawRow[] = [
      { ...baseRow({ "광고비 (VAT-)": 1000 }), 키워드: "키워드A" },
      { ...baseRow({ "광고비 (VAT-)": 5000 }), 키워드: "키워드B" },
      { ...baseRow({ "광고비 (VAT-)": 3000 }), 키워드: "키워드C" },
    ];
    const pivot = buildKeywordPerformance(rows);
    expect(pivot.items.map((i) => i.label)).toEqual([
      "키워드B",
      "키워드C",
      "키워드A",
    ]);
  });

  it("empty input → empty items", () => {
    expect(buildKeywordPerformance([]).items).toEqual([]);
  });
});

describe("buildProductPerformance", () => {
  it("keys on (productId, productName) — same id+name aggregated", () => {
    const rows: MaterialRawRow[] = [
      {
        ...baseRow({ "광고비 (VAT-)": 2000 }),
        소재ID: "ad-001",
        "네이버 쇼핑 상품 ID": "prod-001",
        상품명: "상품A",
      },
      {
        ...baseRow({ "광고비 (VAT-)": 3000 }),
        소재ID: "ad-002",
        "네이버 쇼핑 상품 ID": "prod-001",
        상품명: "상품A",
      },
    ];
    const pivot = buildProductPerformance(rows);
    expect(pivot.items).toHaveLength(1);
    expect(pivot.items[0]!.productId).toBe("prod-001");
    expect(pivot.items[0]!.productName).toBe("상품A");
    expect(pivot.items[0]!.metrics.광고비).toBe(5000);
  });

  it("different products → separate items", () => {
    const rows: MaterialRawRow[] = [
      {
        ...baseRow(),
        소재ID: "ad-001",
        "네이버 쇼핑 상품 ID": "prod-001",
        상품명: "상품A",
      },
      {
        ...baseRow(),
        소재ID: "ad-002",
        "네이버 쇼핑 상품 ID": "prod-002",
        상품명: "상품B",
      },
    ];
    expect(buildProductPerformance(rows).items).toHaveLength(2);
  });
});

describe("buildSearchTermPerformance", () => {
  it("filters out rows with 신청완료=0", () => {
    const rows: SearchTermRawRow[] = [
      { ...baseRow({ 신청완료: 0 }), 검색어: "검색어A" },
      { ...baseRow({ 신청완료: 3 }), 검색어: "검색어B" },
    ];
    const pivot = buildSearchTermPerformance(rows);
    expect(pivot.items).toHaveLength(1);
    expect(pivot.items[0]!.label).toBe("검색어B");
  });

  it("empty after filter → empty items", () => {
    const rows: SearchTermRawRow[] = [
      { ...baseRow({ 신청완료: 0 }), 검색어: "검색어A" },
    ];
    expect(buildSearchTermPerformance(rows).items).toEqual([]);
  });

  it("평균노출순위 weighted average on multi-row input", () => {
    const rows: SearchTermRawRow[] = [
      {
        ...baseRow({ 노출수: 100, 평균노출순위: 1.0, 신청완료: 1 }),
        검색어: "검색어X",
      },
      {
        ...baseRow({ 노출수: 300, 평균노출순위: 3.0, 신청완료: 2 }),
        검색어: "검색어X",
      },
    ];
    const pivot = buildSearchTermPerformance(rows);
    expect(pivot.items[0]!.metrics.평균노출순위).toBeCloseTo(2.5);
  });
});
