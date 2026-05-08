import ExcelJS from "exceljs";
import type {
  DailyRawRow,
  KeywordRawRow,
  SearchTermRawRow,
  MaterialRawRow,
} from "../raw/builder.js";
import {
  HEADERS_DAILY_RAW,
  HEADERS_KEYWORD_RAW,
  HEADERS_SEARCH_TERM_RAW,
  HEADERS_MATERIAL_RAW,
} from "./headers.js";

// Structural interface so this file does not hard-import from pivot/
// (pivot/ is being built in parallel)
export interface PivotSheetLike {
  title?: string;
  rows: Array<Array<{ value: string | number | null; format?: "currency" | "integer" | "percent" | "decimal" }>>;
  hidden?: boolean;
}

export interface ReportData {
  rawDaily: DailyRawRow[];
  rawKeyword: KeywordRawRow[];
  rawSearchTerm: SearchTermRawRow[];
  rawMaterial: MaterialRawRow[];
  pivotSummary: PivotSheetLike;
  pivotMedia: PivotSheetLike;
  pivotKeyword: PivotSheetLike;
  pivotProduct: PivotSheetLike;
  pivotSearchTerm: PivotSheetLike;
}

export interface WriteOptions {
  outputPath: string;
  data: ReportData;
}

export interface WriteResult {
  path: string;
  sheetNames: string[];
  visibility: Record<string, "visible" | "hidden">;
  rowCount: Record<string, number>;
}

const FORMAT_MAP: Record<string, string> = {
  currency: "#,##0",
  integer: "#,##0",
  percent: "0.00%",
  decimal: "0.00",
};

function addPivotSheet(
  wb: ExcelJS.Workbook,
  name: string,
  sheet: PivotSheetLike,
  state: "visible" | "hidden",
): { rowCount: number } {
  const ws = wb.addWorksheet(name, { state });
  let rowCount = 0;
  for (const pivotRow of sheet.rows) {
    const exRow = ws.addRow(pivotRow.map((cell) => cell.value));
    for (let i = 0; i < pivotRow.length; i++) {
      const cell = pivotRow[i];
      if (cell?.format) {
        const fmt = FORMAT_MAP[cell.format];
        if (fmt) {
          exRow.getCell(i + 1).numFmt = fmt;
        }
      }
    }
    rowCount++;
  }
  return { rowCount };
}

type AnyRawRow = DailyRawRow | KeywordRawRow | SearchTermRawRow | MaterialRawRow;

function rawRowValue(row: AnyRawRow, key: string): unknown {
  return (row as unknown as Record<string, unknown>)[key] ?? null;
}

function addRawSheet(
  wb: ExcelJS.Workbook,
  name: string,
  headers: string[],
  rows: AnyRawRow[],
  state: "visible" | "hidden",
): { rowCount: number } {
  const ws = wb.addWorksheet(name, { state });
  ws.addRow(headers);
  for (const row of rows) {
    ws.addRow(headers.map((h) => rawRowValue(row, h)));
  }
  // header row + data rows
  return { rowCount: rows.length + 1 };
}

function addBrandSearchSheet(wb: ExcelJS.Workbook): { rowCount: number } {
  const ws = wb.addWorksheet("브랜드검색 성과", { state: "hidden" });

  ws.addRow(["■ 브랜드검색 소재 영역별 성과 (수기 입력 필요)"]);
  ws.addRow(["광고 소재"]);

  const areas = [
    "홈링크.링크",
    "메인콘텐츠.메인이미지.링크",
    "메인콘텐츠.메인텍스트.타이틀",
    "메인콘텐츠.섬네일.1.링크",
    "메인콘텐츠.섬네일.2.링크",
    "메인콘텐츠.섬네일.3.링크",
    "메인콘텐츠.서브링크.1.텍스트",
    "메인콘텐츠.서브링크.2.텍스트",
    "메인콘텐츠.서브링크.3.텍스트",
    "메인콘텐츠.서브링크.4.텍스트",
  ];

  ws.addRow(["영역", "노출수", "클릭수", "CTR"]);
  for (const area of areas) {
    ws.addRow([area, 0, 0, 0]);
  }

  return { rowCount: 3 + areas.length };
}

export async function writeReport(opts: WriteOptions): Promise<WriteResult> {
  const { outputPath, data } = opts;
  const wb = new ExcelJS.Workbook();

  const sheetNames: string[] = [];
  const visibility: Record<string, "visible" | "hidden"> = {};
  const rowCount: Record<string, number> = {};

  function record(
    name: string,
    state: "visible" | "hidden",
    count: number,
  ): void {
    sheetNames.push(name);
    visibility[name] = state;
    rowCount[name] = count;
  }

  // Sheet 1: SUMMARY — always visible
  {
    const r = addPivotSheet(wb, "SUMMARY", data.pivotSummary, "visible");
    record("SUMMARY", "visible", r.rowCount);
  }

  // Sheet 2: 매체별 성과 — always visible
  {
    const r = addPivotSheet(wb, "매체별 성과", data.pivotMedia, "visible");
    record("매체별 성과", "visible", r.rowCount);
  }

  // Sheet 3: 키워드 성과 — visible if KeywordRaw exists
  {
    const state = data.rawKeyword.length > 0 ? "visible" : "hidden";
    const r = addPivotSheet(wb, "키워드 성과", data.pivotKeyword, state);
    record("키워드 성과", state, r.rowCount);
  }

  // Sheet 4: 상품 성과 — hidden if MaterialRaw empty
  {
    const state = data.rawMaterial.length === 0 ? "hidden" : "visible";
    const r = addPivotSheet(wb, "상품 성과", data.pivotProduct, state);
    record("상품 성과", state, r.rowCount);
  }

  // Sheet 5: 검색어 성과 — hidden if SearchTermRaw empty
  {
    const state = data.rawSearchTerm.length === 0 ? "hidden" : "visible";
    const r = addPivotSheet(wb, "검색어 성과", data.pivotSearchTerm, state);
    record("검색어 성과", state, r.rowCount);
  }

  // Sheet 6: 브랜드검색 성과 — always hidden (static template placeholder)
  {
    const r = addBrandSearchSheet(wb);
    record("브랜드검색 성과", "hidden", r.rowCount);
  }

  // Sheet 7: 소재RAW — hidden if empty
  {
    const state = data.rawMaterial.length === 0 ? "hidden" : "visible";
    const r = addRawSheet(wb, "소재RAW", HEADERS_MATERIAL_RAW, data.rawMaterial, state);
    record("소재RAW", state, r.rowCount);
  }

  // Sheet 8: 검색어RAW — hidden if empty
  {
    const state = data.rawSearchTerm.length === 0 ? "hidden" : "visible";
    const r = addRawSheet(wb, "검색어RAW", HEADERS_SEARCH_TERM_RAW, data.rawSearchTerm, state);
    record("검색어RAW", state, r.rowCount);
  }

  // Sheet 9: 일별RAW — always visible
  {
    const r = addRawSheet(wb, "일별RAW", HEADERS_DAILY_RAW, data.rawDaily, "visible");
    record("일별RAW", "visible", r.rowCount);
  }

  // Sheet 10: 키워드RAW — always visible
  {
    const r = addRawSheet(wb, "키워드RAW", HEADERS_KEYWORD_RAW, data.rawKeyword, "visible");
    record("키워드RAW", "visible", r.rowCount);
  }

  await wb.xlsx.writeFile(outputPath);

  return { path: outputPath, sheetNames, visibility, rowCount };
}
