import { describe, it, expect, afterEach } from "vitest";
import { writeReport } from "../src/excel/writer.js";
import type { ReportData } from "../src/excel/writer.js";
import { HEADERS_DAILY_RAW } from "../src/excel/headers.js";
import ExcelJS from "exceljs";
import { mkdtempSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";

function tempDir(): string {
  return mkdtempSync(path.join(os.tmpdir(), "excel-test-"));
}

function emptyReport(overrides: Partial<ReportData> = {}): ReportData {
  return {
    rawDaily: [],
    rawKeyword: [],
    rawSearchTerm: [],
    rawMaterial: [],
    pivotSummary: {
      byMedia: [],
      byCampaignType: [],
      byDevice: [],
      total: zeroMetrics(),
    },
    pivotMedia: { monthly: [], weekly: [], daily: [], hidden: true },
    pivotKeyword: { items: [] },
    pivotProduct: { items: [] },
    pivotSearchTerm: { items: [] },
    ...overrides,
  };
}

function zeroMetrics() {
  return {
    광고비: 0,
    노출수: 0,
    클릭수: 0,
    CTR: 0,
    CPC: 0,
    신청완료: 0,
    신청완료CVR: 0,
    신청완료CPA: 0,
    평균노출순위: 0,
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

describe("writeReport", () => {
  const tmpDirs: string[] = [];

  afterEach(() => {
    for (const d of tmpDirs) {
      try {
        rmSync(d, { recursive: true, force: true });
      } catch {
        /* ignore */
      }
    }
    tmpDirs.length = 0;
  });

  it("writes output file to disk and returns correct path", async () => {
    const dir = tempDir();
    tmpDirs.push(dir);
    const outputPath = path.join(dir, "report.xlsx");

    const result = await writeReport({ outputPath, data: emptyReport() });

    expect(result.path).toBe(outputPath);
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.readFile(outputPath);
    expect(wb.worksheets.length).toBeGreaterThan(0);
  });

  it("produces exactly 10 sheets in the correct order", async () => {
    const dir = tempDir();
    tmpDirs.push(dir);
    const outputPath = path.join(dir, "report.xlsx");

    await writeReport({ outputPath, data: emptyReport() });

    const wb = new ExcelJS.Workbook();
    await wb.xlsx.readFile(outputPath);

    const names = wb.worksheets.map((ws) => ws.name);
    expect(names).toEqual(EXPECTED_SHEET_NAMES);
  });

  it("sheet 6 (브랜드검색 성과) is always hidden", async () => {
    const dir = tempDir();
    tmpDirs.push(dir);
    const outputPath = path.join(dir, "report.xlsx");

    await writeReport({ outputPath, data: emptyReport() });

    const wb = new ExcelJS.Workbook();
    await wb.xlsx.readFile(outputPath);

    const brandSheet = wb.getWorksheet("브랜드검색 성과")!;
    expect(brandSheet.state).toBe("hidden");
  });

  it("일별RAW header row matches HEADERS_DAILY_RAW exactly (with trailing dot)", async () => {
    const dir = tempDir();
    tmpDirs.push(dir);
    const outputPath = path.join(dir, "report.xlsx");

    await writeReport({ outputPath, data: emptyReport() });

    const wb = new ExcelJS.Workbook();
    await wb.xlsx.readFile(outputPath);

    const ws = wb.getWorksheet("일별RAW")!;
    const headers: string[] = [];
    ws.getRow(1).eachCell({ includeEmpty: false }, (cell) => {
      headers.push(String(cell.value));
    });

    expect(headers).toEqual(HEADERS_DAILY_RAW);
    expect(headers.every((h) => h.endsWith("."))).toBe(true);
  });

  it("일별RAW data row stores 클릭수 as numeric with #,##0 format", async () => {
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

    await writeReport({
      outputPath,
      data: emptyReport({ rawDaily: [dailyRow] }),
    });

    const wb = new ExcelJS.Workbook();
    await wb.xlsx.readFile(outputPath);

    const ws = wb.getWorksheet("일별RAW")!;
    const headers: string[] = [];
    ws.getRow(1).eachCell({ includeEmpty: false }, (c) =>
      headers.push(String(c.value)),
    );
    const clkIdx = headers.indexOf("클릭수.") + 1;
    expect(clkIdx).toBeGreaterThan(0);
    const cell = ws.getRow(2).getCell(clkIdx);
    expect(cell.value).toBe(10);
    expect(cell.numFmt).toBe("#,##0");
  });

  it("일별RAW 날짜 column is stored as Date with mm-dd-yy format", async () => {
    const dir = tempDir();
    tmpDirs.push(dir);
    const outputPath = path.join(dir, "report.xlsx");

    const dailyRow = {
      월별: "2026-02",
      주차: "2026-02-01주차",
      날짜: "2026-02-03",
      매체: "네이버",
      캠페인유형: "파워링크",
      캠페인: "C",
      광고그룹: "G",
      디바이스: "PC" as const,
      "광고비 (VAT-)": 0,
      노출수: 0,
      클릭수: 0,
      구매완료: 0,
      회원가입: 0,
      신청완료: 0,
      기타전환: 0,
      전환매출액: 0,
      평균노출순위: 0,
    };

    await writeReport({
      outputPath,
      data: emptyReport({ rawDaily: [dailyRow] }),
    });

    const wb = new ExcelJS.Workbook();
    await wb.xlsx.readFile(outputPath);

    const ws = wb.getWorksheet("일별RAW")!;
    const cell = ws.getRow(2).getCell(3); // 날짜 column
    expect(cell.numFmt).toBe("mm-dd-yy");
    expect(cell.value).toBeInstanceOf(Date);
  });

  it("SUMMARY title block is at C2:K4 merged with FFE5ECFF fill", async () => {
    const dir = tempDir();
    tmpDirs.push(dir);
    const outputPath = path.join(dir, "report.xlsx");

    await writeReport({ outputPath, data: emptyReport() });

    const wb = new ExcelJS.Workbook();
    await wb.xlsx.readFile(outputPath);

    const ws = wb.getWorksheet("SUMMARY")!;
    expect(ws.getRow(2).getCell(3).value).toBe("helloMAX Ads Report");
    const fill = ws.getRow(2).getCell(3).fill as ExcelJS.FillPattern;
    expect((fill.fgColor as { argb?: string })?.argb).toBe("FFE5ECFF");
    const merges = ws.model?.merges ?? [];
    expect(merges).toContain("C2:K4");
  });

  it("매체별 성과 has '■ 매체별 상세 성과' title at B2", async () => {
    const dir = tempDir();
    tmpDirs.push(dir);
    const outputPath = path.join(dir, "report.xlsx");

    await writeReport({
      outputPath,
      data: emptyReport({
        pivotMedia: { monthly: [], weekly: [], daily: [], hidden: false },
      }),
    });

    const wb = new ExcelJS.Workbook();
    await wb.xlsx.readFile(outputPath);
    const ws = wb.getWorksheet("매체별 성과")!;
    expect(ws.getRow(2).getCell(2).value).toBe("■ 매체별 상세 성과");
  });

  it("empty rawMaterial → 소재RAW and 상품 성과 are hidden", async () => {
    const dir = tempDir();
    tmpDirs.push(dir);
    const outputPath = path.join(dir, "report.xlsx");

    await writeReport({ outputPath, data: emptyReport({ rawMaterial: [] }) });

    const wb = new ExcelJS.Workbook();
    await wb.xlsx.readFile(outputPath);

    expect(wb.getWorksheet("소재RAW")!.state).toBe("hidden");
    expect(wb.getWorksheet("상품 성과")!.state).toBe("hidden");
  });

  it("empty rawSearchTerm → 검색어RAW and 검색어 성과 are hidden", async () => {
    const dir = tempDir();
    tmpDirs.push(dir);
    const outputPath = path.join(dir, "report.xlsx");

    await writeReport({ outputPath, data: emptyReport({ rawSearchTerm: [] }) });

    const wb = new ExcelJS.Workbook();
    await wb.xlsx.readFile(outputPath);

    expect(wb.getWorksheet("검색어RAW")!.state).toBe("hidden");
    expect(wb.getWorksheet("검색어 성과")!.state).toBe("hidden");
  });

  it("writeReport result.visibility and sheetNames match file contents", async () => {
    const dir = tempDir();
    tmpDirs.push(dir);
    const outputPath = path.join(dir, "report.xlsx");

    const result = await writeReport({ outputPath, data: emptyReport() });

    expect(result.sheetNames).toEqual(EXPECTED_SHEET_NAMES);
    expect(result.visibility["브랜드검색 성과"]).toBe("hidden");
    expect(result.visibility["SUMMARY"]).toBe("visible");
    expect(result.visibility["일별RAW"]).toBe("visible");
    expect(result.visibility["소재RAW"]).toBe("hidden");
  });
});
