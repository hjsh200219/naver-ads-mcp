import { describe, it, expect } from "vitest";
import { safeDiv, weightedAvgRank, groupAggregate } from "../src/pivot/aggregate.js";
import { buildSummary } from "../src/pivot/summary.js";
import { buildMediaPerformance } from "../src/pivot/media.js";
import { buildKeywordPerformance } from "../src/pivot/keyword.js";
import { buildProductPerformance } from "../src/pivot/product.js";
import { buildSearchTermPerformance } from "../src/pivot/search-term.js";
import type { DailyRawRow, KeywordRawRow, SearchTermRawRow, MaterialRawRow } from "../src/raw/builder.js";

// Minimal base row fixture
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
    // row1: 100 imp, rank 1.0 → contributes 100
    // row2: 300 imp, rank 3.0 → contributes 900
    // weighted = 1000/400 = 2.5
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
    const rows = [
      baseRow({ 캠페인: "A" }),
      baseRow({ 캠페인: "B" }),
    ];
    const map = groupAggregate(rows, (r) => r.캠페인);
    expect(map.size).toBe(2);
  });
});

describe("buildSummary", () => {
  it("empty input → header row + zero total row (2 rows total)", () => {
    const sheet = buildSummary([]);
    expect(sheet.title).toBe("SUMMARY");
    // header + total row
    expect(sheet.rows.length).toBe(2);
    // total row label
    expect(sheet.rows[1]![0]!.value).toBe("총합계");
  });

  it("2 daily rows from same campaign → sums in media row and total row", () => {
    const rows = [
      baseRow({ "광고비 (VAT-)": 5000, 노출수: 200, 클릭수: 20, 신청완료: 2 }),
      baseRow({ "광고비 (VAT-)": 3000, 노출수: 100, 클릭수: 10, 신청완료: 1 }),
    ];
    const sheet = buildSummary(rows);
    // rows: header, 네이버 data row, total row
    expect(sheet.rows.length).toBe(3);
    const dataRow = sheet.rows[1]!;
    expect(dataRow[0]!.value).toBe("네이버");
    expect(dataRow[1]!.value).toBe(8000); // 광고비
    expect(dataRow[3]!.value).toBe(30);   // 클릭수
    const totalRow = sheet.rows[2]!;
    expect(totalRow[0]!.value).toBe("총합계");
    expect(totalRow[1]!.value).toBe(8000);
  });

  it("CTR computation: 20 clicks / 300 impressions", () => {
    const rows = [
      baseRow({ 노출수: 300, 클릭수: 20 }),
    ];
    const sheet = buildSummary(rows);
    const dataRow = sheet.rows[1]!;
    // CTR is at index 4
    expect(dataRow[4]!.value).toBeCloseTo(20 / 300);
  });

  it("CPA on zero-conversion row → 0", () => {
    const rows = [baseRow({ 신청완료: 0 })];
    const sheet = buildSummary(rows);
    const dataRow = sheet.rows[1]!;
    // CPA at index 8
    expect(dataRow[8]!.value).toBe(0);
  });
});

describe("buildMediaPerformance", () => {
  it("has separate monthly and weekly sections with blank row between", () => {
    const rows = [
      baseRow({ 월별: "2026-02", 주차: "2026-02-01주차" }),
      baseRow({ 월별: "2026-03", 주차: "2026-03-01주차" }),
    ];
    const sheet = buildMediaPerformance(rows);
    expect(sheet.title).toBe("매체별성과");

    // Find the blank row separating sections
    const blankIdx = sheet.rows.findIndex((row) => row[0]?.value === null);
    expect(blankIdx).toBeGreaterThan(0);

    // Before blank: monthly section
    const monthlySection = sheet.rows.slice(0, blankIdx);
    expect(monthlySection[0]![0]!.value).toBe("월별 성과");

    // After blank: weekly section
    const weeklySection = sheet.rows.slice(blankIdx + 1);
    expect(weeklySection[0]![0]!.value).toBe("주차별 성과");
  });

  it("hidden=true when rows empty", () => {
    const sheet = buildMediaPerformance([]);
    expect(sheet.hidden).toBe(true);
  });

  it("hidden=false when rows present", () => {
    const sheet = buildMediaPerformance([baseRow()]);
    expect(sheet.hidden).toBe(false);
  });
});

describe("buildKeywordPerformance", () => {
  it("sorts DESC by 광고비", () => {
    const rows: KeywordRawRow[] = [
      { ...baseRow({ "광고비 (VAT-)": 1000 }), 키워드: "키워드A" },
      { ...baseRow({ "광고비 (VAT-)": 5000 }), 키워드: "키워드B" },
      { ...baseRow({ "광고비 (VAT-)": 3000 }), 키워드: "키워드C" },
    ];
    const sheet = buildKeywordPerformance(rows);
    // rows[0] = header, rows[1..] = data sorted desc
    expect(sheet.rows[1]![0]!.value).toBe("키워드B");
    expect(sheet.rows[2]![0]!.value).toBe("키워드C");
    expect(sheet.rows[3]![0]!.value).toBe("키워드A");
  });

  it("header has 키워드 as first column", () => {
    const sheet = buildKeywordPerformance([]);
    expect(sheet.rows[0]![0]!.value).toBe("키워드");
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
    const sheet = buildProductPerformance(rows);
    // header + 1 data row (both rows share same product)
    expect(sheet.rows.length).toBe(2);
    expect(sheet.rows[1]![0]!.value).toBe("prod-001");
    expect(sheet.rows[1]![1]!.value).toBe("상품A");
    expect(sheet.rows[1]![2]!.value).toBe(5000); // 광고비 summed
  });

  it("different products → separate rows", () => {
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
    const sheet = buildProductPerformance(rows);
    // header + 2 data rows
    expect(sheet.rows.length).toBe(3);
  });
});

describe("buildSearchTermPerformance", () => {
  it("filters out rows with 신청완료=0", () => {
    const rows: SearchTermRawRow[] = [
      { ...baseRow({ 신청완료: 0 }), 검색어: "검색어A" },
      { ...baseRow({ 신청완료: 3 }), 검색어: "검색어B" },
    ];
    const sheet = buildSearchTermPerformance(rows);
    // header + 1 data row (검색어A filtered out)
    expect(sheet.rows.length).toBe(2);
    expect(sheet.rows[1]![0]!.value).toBe("검색어B");
  });

  it("empty after filter → only header", () => {
    const rows: SearchTermRawRow[] = [
      { ...baseRow({ 신청완료: 0 }), 검색어: "검색어A" },
    ];
    const sheet = buildSearchTermPerformance(rows);
    expect(sheet.rows.length).toBe(1);
  });

  it("평균노출순위 weighted average on multi-row input", () => {
    const rows: SearchTermRawRow[] = [
      { ...baseRow({ 노출수: 100, 평균노출순위: 1.0, 신청완료: 1 }), 검색어: "검색어X" },
      { ...baseRow({ 노출수: 300, 평균노출순위: 3.0, 신청완료: 2 }), 검색어: "검색어X" },
    ];
    const sheet = buildSearchTermPerformance(rows);
    // 평균노출순위 at index 9
    expect(sheet.rows[1]![9]!.value).toBeCloseTo(2.5);
  });
});
