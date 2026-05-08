import { describe, it, expect, afterEach } from "vitest";
import { writeReport } from "../src/excel/writer.js";
import type { ReportData, PivotSheetLike } from "../src/excel/writer.js";
import { HEADERS_DAILY_RAW } from "../src/excel/headers.js";
import ExcelJS from "exceljs";
import { mkdtempSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";

// ---- helpers ----

function tempDir(): string {
  return mkdtempSync(path.join(os.tmpdir(), "excel-test-"));
}

function emptyPivot(): PivotSheetLike {
  return { rows: [] };
}

function pivotWithCurrency(): PivotSheetLike {
  return {
    rows: [
      [
        { value: "광고비", format: "currency" },
        { value: 123456, format: "currency" },
      ],
    ],
  };
}

function makeData(overrides: Partial<ReportData> = {}): ReportData {
  return {
    rawDaily: [],
    rawKeyword: [],
    rawSearchTerm: [],
    rawMaterial: [],
    pivotSummary: emptyPivot(),
    pivotMedia: emptyPivot(),
    pivotKeyword: emptyPivot(),
    pivotProduct: emptyPivot(),
    pivotSearchTerm: emptyPivot(),
    ...overrides,
  };
}

const EXPECTED_SHEET_NAMES = [
  "SUMMARY",
  "매체별 성과",
  "키워드 성과",
  "상품 성과",
  "검색어 성과",
  "브랜드검색 성과",
  "소재RAW",
  "검색어RAW",
  "일별RAW",
  "키워드RAW",
];

// ---- tests ----

describe("writeReport", () => {
  const tmpDirs: string[] = [];

  afterEach(() => {
    for (const d of tmpDirs) {
      try { rmSync(d, { recursive: true, force: true }); } catch { /* ignore */ }
    }
    tmpDirs.length = 0;
  });

  it("writes output file to disk and returns correct path", async () => {
    const dir = tempDir();
    tmpDirs.push(dir);
    const outputPath = path.join(dir, "report.xlsx");

    const result = await writeReport({ outputPath, data: makeData() });

    expect(result.path).toBe(outputPath);
    // File is readable by ExcelJS
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.readFile(outputPath);
    expect(wb.worksheets.length).toBeGreaterThan(0);
  });

  it("produces exactly 10 sheets in the correct order", async () => {
    const dir = tempDir();
    tmpDirs.push(dir);
    const outputPath = path.join(dir, "report.xlsx");

    await writeReport({ outputPath, data: makeData() });

    const wb = new ExcelJS.Workbook();
    await wb.xlsx.readFile(outputPath);

    const names = wb.worksheets.map((ws) => ws.name);
    expect(names).toHaveLength(10);
    expect(names).toEqual(EXPECTED_SHEET_NAMES);
  });

  it("SUMMARY is the 1st sheet and 키워드RAW is the 10th sheet", async () => {
    const dir = tempDir();
    tmpDirs.push(dir);
    const outputPath = path.join(dir, "report.xlsx");

    await writeReport({ outputPath, data: makeData() });

    const wb = new ExcelJS.Workbook();
    await wb.xlsx.readFile(outputPath);

    expect(wb.worksheets[0]?.name).toBe("SUMMARY");
    expect(wb.worksheets[9]?.name).toBe("키워드RAW");
  });

  it("sheet 6 (브랜드검색 성과) is always hidden", async () => {
    const dir = tempDir();
    tmpDirs.push(dir);
    const outputPath = path.join(dir, "report.xlsx");

    await writeReport({ outputPath, data: makeData() });

    const wb = new ExcelJS.Workbook();
    await wb.xlsx.readFile(outputPath);

    const brandSheet = wb.getWorksheet("브랜드검색 성과");
    expect(brandSheet).toBeDefined();
    expect((brandSheet as ExcelJS.Worksheet).state).toBe("hidden");
  });

  it("일별RAW header row matches HEADERS_DAILY_RAW exactly", async () => {
    const dir = tempDir();
    tmpDirs.push(dir);
    const outputPath = path.join(dir, "report.xlsx");

    await writeReport({ outputPath, data: makeData() });

    const wb = new ExcelJS.Workbook();
    await wb.xlsx.readFile(outputPath);

    const ws = wb.getWorksheet("일별RAW") as ExcelJS.Worksheet;
    const headerRow = ws.getRow(1);
    const headers: string[] = [];
    headerRow.eachCell({ includeEmpty: false }, (cell) => {
      headers.push(String(cell.value));
    });

    expect(headers).toEqual(HEADERS_DAILY_RAW);
  });

  it("data row in 일별RAW round-trips correctly (클릭수=10)", async () => {
    const dir = tempDir();
    tmpDirs.push(dir);
    const outputPath = path.join(dir, "report.xlsx");

    const dailyRow = {
      월별: "2026-02",
      주차: "2026-02-01주차",
      날짜: "2026-02-03",
      매체: "네이버",
      캠페인유형: "파워링크",
      캠페인: "테스트캠페인",
      광고그룹: "테스트광고그룹",
      디바이스: "PC" as const,
      "광고비 (VAT-)": 5000,
      노출수: 200,
      클릭수: 10,
      구매완료: 1,
      회원가입: 0,
      신청완료: 0,
      기타전환: 0,
      전환매출액: 50000,
      평균노출순위: 1.5,
    };

    await writeReport({ outputPath, data: makeData({ rawDaily: [dailyRow] }) });

    const wb = new ExcelJS.Workbook();
    await wb.xlsx.readFile(outputPath);

    const ws = wb.getWorksheet("일별RAW") as ExcelJS.Worksheet;
    // Row 1 = headers, Row 2 = first data row
    const dataRow = ws.getRow(2);

    // Find 클릭수 column index (1-based)
    const headerRow = ws.getRow(1);
    let clkIdx = -1;
    headerRow.eachCell({ includeEmpty: false }, (cell, colNum) => {
      if (cell.value === "클릭수") clkIdx = colNum;
    });

    expect(clkIdx).toBeGreaterThan(0);
    expect(dataRow.getCell(clkIdx).value).toBe(10);
  });

  it("pivot sheet currency format is applied (numFmt = '#,##0')", async () => {
    const dir = tempDir();
    tmpDirs.push(dir);
    const outputPath = path.join(dir, "report.xlsx");

    await writeReport({
      outputPath,
      data: makeData({ pivotSummary: pivotWithCurrency() }),
    });

    const wb = new ExcelJS.Workbook();
    await wb.xlsx.readFile(outputPath);

    const ws = wb.getWorksheet("SUMMARY") as ExcelJS.Worksheet;
    const cell = ws.getRow(1).getCell(2); // second cell has value=123456 with currency format
    expect(cell.numFmt).toBe("#,##0");
  });

  it("empty rawMaterial → 소재RAW and 상품 성과 are hidden", async () => {
    const dir = tempDir();
    tmpDirs.push(dir);
    const outputPath = path.join(dir, "report.xlsx");

    await writeReport({ outputPath, data: makeData({ rawMaterial: [] }) });

    const wb = new ExcelJS.Workbook();
    await wb.xlsx.readFile(outputPath);

    expect((wb.getWorksheet("소재RAW") as ExcelJS.Worksheet).state).toBe("hidden");
    expect((wb.getWorksheet("상품 성과") as ExcelJS.Worksheet).state).toBe("hidden");
  });

  it("empty rawSearchTerm → 검색어RAW and 검색어 성과 are hidden", async () => {
    const dir = tempDir();
    tmpDirs.push(dir);
    const outputPath = path.join(dir, "report.xlsx");

    await writeReport({ outputPath, data: makeData({ rawSearchTerm: [] }) });

    const wb = new ExcelJS.Workbook();
    await wb.xlsx.readFile(outputPath);

    expect((wb.getWorksheet("검색어RAW") as ExcelJS.Worksheet).state).toBe("hidden");
    expect((wb.getWorksheet("검색어 성과") as ExcelJS.Worksheet).state).toBe("hidden");
  });

  it("writeReport result.visibility and sheetNames match file contents", async () => {
    const dir = tempDir();
    tmpDirs.push(dir);
    const outputPath = path.join(dir, "report.xlsx");

    const result = await writeReport({ outputPath, data: makeData() });

    expect(result.sheetNames).toEqual(EXPECTED_SHEET_NAMES);
    expect(result.visibility["브랜드검색 성과"]).toBe("hidden");
    expect(result.visibility["SUMMARY"]).toBe("visible");
    expect(result.visibility["일별RAW"]).toBe("visible");
    expect(result.visibility["키워드RAW"]).toBe("visible");
    // empty rawMaterial → 소재RAW hidden
    expect(result.visibility["소재RAW"]).toBe("hidden");
  });
});
