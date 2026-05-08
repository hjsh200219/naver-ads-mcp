import ExcelJS from "exceljs";
import type { Cell, Worksheet } from "exceljs";
import type {
  DailyRawRow,
  KeywordRawRow,
  SearchTermRawRow,
  MaterialRawRow,
  RawRowBase,
} from "../raw/builder.js";
import type {
  SummaryPivot,
  MediaPivot,
  ListPivot,
  ProductPivot,
  PivotMetrics,
  MetricsGroup,
} from "../pivot/types.js";
import {
  HEADERS_DAILY_RAW,
  HEADERS_KEYWORD_RAW,
  HEADERS_SEARCH_TERM_RAW,
  HEADERS_MATERIAL_RAW,
  CONV_COLUMNS,
  stripDot,
} from "./headers.js";
import {
  NF_INT_ACCT,
  NF_DEC1_ACCT,
  NF_PCT,
  NF_INT_RAW,
  NF_DEC2_RAW,
  NF_DATE_RAW,
  FILL_TITLE,
  FILL_SECTION,
  FILL_CONV,
  FONT_MALGUN_9,
  FONT_MALGUN_9_BOLD,
  FONT_MALGUN_11,
  FONT_TITLE_25,
  BORDER_THIN,
  WIDTHS_SUMMARY,
  WIDTHS_MEDIA,
  WIDTHS_KEYWORD,
  WIDTHS_PRODUCT,
  WIDTHS_SEARCH_TERM,
  WIDTHS_BRAND,
  WIDTHS_MATERIAL_RAW,
  WIDTH_DATE_RAW,
} from "./styles.js";

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export interface ReportData {
  rawDaily: DailyRawRow[];
  rawKeyword: KeywordRawRow[];
  rawSearchTerm: SearchTermRawRow[];
  rawMaterial: MaterialRawRow[];
  pivotSummary: SummaryPivot;
  pivotMedia: MediaPivot;
  pivotKeyword: ListPivot;
  pivotProduct: ProductPivot;
  pivotSearchTerm: ListPivot;
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

// Backward-compatibility shim used only by tests/excel.test.ts.
export interface PivotSheetLike {
  rows?: unknown[];
}

// ---------------------------------------------------------------------------
// Style helpers
// ---------------------------------------------------------------------------

function setColumnWidths(
  ws: Worksheet,
  widths: ReadonlyArray<number | null>,
): void {
  for (let i = 0; i < widths.length; i++) {
    const w = widths[i];
    if (w !== null && w !== undefined) {
      const col = ws.getColumn(i + 1);
      col.width = w;
      // ExcelJS strips column entries whose width === DEFAULT_COLUMN_WIDTH (9)
      // unless `isDefault` returns false. Assigning any style flips that flag,
      // matching the reference template which applies a style to every column.
      col.style = { font: FONT_MALGUN_9 };
    }
  }
}

interface CellStyle {
  font?: Partial<ExcelJS.Font>;
  fill?: ExcelJS.Fill;
  border?: Partial<ExcelJS.Borders>;
  alignment?: Partial<ExcelJS.Alignment>;
  numFmt?: string;
}

function applyStyle(cell: Cell, s: CellStyle): void {
  if (s.font) cell.font = s.font;
  if (s.fill) cell.fill = s.fill;
  if (s.border) cell.border = s.border;
  if (s.alignment) cell.alignment = s.alignment;
  if (s.numFmt) cell.numFmt = s.numFmt;
}

// Numeric formats per metric column (10 cols; first col is label).
const METRIC_NF = [
  null, // label
  NF_INT_ACCT, // 광고비
  NF_INT_ACCT, // 노출수
  NF_INT_ACCT, // 클릭수
  NF_PCT, // CTR
  NF_INT_ACCT, // CPC
  NF_INT_ACCT, // 신청완료
  NF_PCT, // 신청완료CVR
  NF_INT_ACCT, // 신청완료CPA
  NF_DEC1_ACCT, // 평균노출순위
] as const;

const HEADER_LABELS_PIVOT = [
  "광고비 (VAT-)",
  "노출수",
  "클릭수",
  "CTR",
  "CPC",
  "신청완료",
  "신청완료CVR",
  "신청완료CPA",
  "평균노출순위",
];

const HEADER_ALIGN_CENTER_IDX = new Set([0, 1, 2, 3, 4, 5, 9]); // 신청완료/CVR/CPA align "/middle"

// Headers for which alignment should be center (vs. just middle). The
// reference uses "center/middle" for the label column and most metrics, but
// only "middle" (no horizontal) for 신청완료/CVR/CPA. Keep that distinction.
function pivotHeaderAlignment(idx: number): Partial<ExcelJS.Alignment> {
  if (HEADER_ALIGN_CENTER_IDX.has(idx)) {
    return { horizontal: "center", vertical: "middle" };
  }
  return { vertical: "middle" };
}

function metricsToCells(label: string, m: PivotMetrics): (string | number)[] {
  return [
    label,
    m.광고비,
    m.노출수,
    m.클릭수,
    m.CTR,
    m.CPC,
    m.신청완료,
    m.신청완료CVR,
    m.신청완료CPA,
    m.평균노출순위,
  ];
}

const ZERO_METRICS: PivotMetrics = {
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

// ---------------------------------------------------------------------------
// Pivot section renderer (used by SUMMARY's three sections + every other
// pivot sheet). Layout:
//
//   row N:   subhead (theme-tint fill)
//   row N+1: 월별  (모두)
//   row N+2: 주차  (모두)
//   row N+3: blank
//   row N+4: header [labelCol, "광고비 (VAT-)", ..., "평균노출순위"]
//   row N+5: (비어 있음) zero data row
//   row N+6 .. : data rows
//   row N+6+|data|: 총합계 (optional)
//
// `startCol` is the 1-based column where the section's left edge sits
// (B=2 for SUMMARY/단일 pivot, A=1 won't be used here).
//
// Returns the row immediately AFTER the rendered section (1 blank line).
// ---------------------------------------------------------------------------

interface PivotSectionOptions {
  subhead: string;
  labelHeader: string;
  groups: MetricsGroup[];
  total?: PivotMetrics;
  /** Show "월별 (모두)" / "주차 (모두)" filter rows. */
  showFilters: boolean;
}

function renderPivotSection(
  ws: Worksheet,
  startRow: number,
  startCol: number,
  opts: PivotSectionOptions,
): number {
  const { subhead, labelHeader, groups, total, showFilters } = opts;

  // Subhead row
  const subheadCell = ws.getRow(startRow).getCell(startCol);
  subheadCell.value = subhead;
  applyStyle(subheadCell, {
    font: FONT_MALGUN_9,
    fill: FILL_SECTION,
    border: BORDER_THIN,
    alignment: { vertical: "middle" },
  });

  let cursor = startRow + 1;
  if (showFilters) {
    for (const [label, value] of [
      ["월별", "(모두)"],
      ["주차", "(모두)"],
    ]) {
      const r = ws.getRow(cursor);
      const c1 = r.getCell(startCol);
      c1.value = label;
      applyStyle(c1, {
        font: FONT_MALGUN_9,
        border: BORDER_THIN,
        alignment: { vertical: "middle" },
      });
      const c2 = r.getCell(startCol + 1);
      c2.value = value;
      applyStyle(c2, {
        font: FONT_MALGUN_9,
        border: BORDER_THIN,
        alignment: { vertical: "middle" },
      });
      cursor++;
    }
    cursor++; // blank
  }

  // Header row
  const headerRow = ws.getRow(cursor);
  const headerCells = [labelHeader, ...HEADER_LABELS_PIVOT];
  for (let i = 0; i < headerCells.length; i++) {
    const cell = headerRow.getCell(startCol + i);
    cell.value = headerCells[i]!;
    applyStyle(cell, {
      font: FONT_MALGUN_9,
      border: BORDER_THIN,
      alignment: pivotHeaderAlignment(i),
    });
  }
  cursor++;

  // (비어 있음) zero row
  writeMetricRow(ws, cursor, startCol, "(비어 있음)", ZERO_METRICS);
  cursor++;

  // Data rows
  for (const g of groups) {
    writeMetricRow(ws, cursor, startCol, g.label, g.metrics);
    cursor++;
  }

  // Total row (optional)
  if (total) {
    writeMetricRow(ws, cursor, startCol, "총합계", total);
    cursor++;
  }

  return cursor;
}

function writeMetricRow(
  ws: Worksheet,
  rowIdx: number,
  startCol: number,
  label: string,
  m: PivotMetrics,
): void {
  const row = ws.getRow(rowIdx);
  const values = metricsToCells(label, m);
  for (let i = 0; i < values.length; i++) {
    const cell = row.getCell(startCol + i);
    cell.value = values[i]!;
    const align: Partial<ExcelJS.Alignment> =
      i === 0
        ? { horizontal: "left", vertical: "middle" }
        : { vertical: "middle" };
    applyStyle(cell, {
      font: FONT_MALGUN_9,
      border: BORDER_THIN,
      alignment: align,
      numFmt: METRIC_NF[i] ?? undefined,
    });
  }
}

// ---------------------------------------------------------------------------
// Sheet writers
// ---------------------------------------------------------------------------

function writeSummary(
  wb: ExcelJS.Workbook,
  pivot: SummaryPivot,
): { rowCount: number } {
  const ws = wb.addWorksheet("SUMMARY", { state: "visible" });
  setColumnWidths(ws, WIDTHS_SUMMARY);

  // Title block: C2:K4 merged
  ws.mergeCells("C2:K4");
  for (let r = 2; r <= 4; r++) {
    const row = ws.getRow(r);
    row.height = 16.5;
    for (let c = 3; c <= 11; c++) {
      const cell = row.getCell(c);
      cell.value = "helloMAX Ads Report";
      applyStyle(cell, {
        font: FONT_TITLE_25,
        fill: FILL_TITLE,
        border: BORDER_THIN,
        alignment: { horizontal: "center", vertical: "middle" },
      });
    }
  }

  // Three sections at fixed start rows; data length flexes downward.
  let cursor = 15;
  cursor = renderPivotSection(ws, cursor, 2, {
    subhead: "매체별 성과",
    labelHeader: "매체",
    groups: pivot.byMedia,
    total: pivot.total,
    showFilters: true,
  });
  cursor++; // 1 blank line

  cursor = renderPivotSection(ws, cursor, 2, {
    subhead: "캠페인 유형별 성과",
    labelHeader: "캠페인 유형",
    groups: pivot.byCampaignType,
    total: pivot.total,
    showFilters: true,
  });
  cursor++;

  cursor = renderPivotSection(ws, cursor, 2, {
    subhead: "디바이스별 성과",
    labelHeader: "디바이스",
    groups: pivot.byDevice,
    total: pivot.total,
    showFilters: true,
  });

  return { rowCount: cursor - 1 };
}

function writeMediaPerformance(
  wb: ExcelJS.Workbook,
  pivot: MediaPivot,
): { rowCount: number } {
  const state: "visible" | "hidden" = pivot.hidden ? "hidden" : "visible";
  const ws = wb.addWorksheet("매체별 성과", { state });
  setColumnWidths(ws, WIDTHS_MEDIA);

  // Title row 2
  const title = ws.getRow(2).getCell(2);
  title.value = "■ 매체별 상세 성과";
  applyStyle(title, {
    font: FONT_MALGUN_9_BOLD,
    fill: FILL_TITLE,
    border: BORDER_THIN,
    alignment: { vertical: "middle" },
  });

  // Three sub-sections at fixed start rows. No 총합계.
  let cursor = 4;
  cursor = renderPivotSection(ws, cursor, 2, {
    subhead: "월별 데이터",
    labelHeader: "월 구분",
    groups: pivot.monthly,
    showFilters: false,
  });
  cursor++; // blank

  cursor = renderPivotSection(ws, cursor, 2, {
    subhead: "주차별 데이터",
    labelHeader: "주차 구분",
    groups: pivot.weekly,
    showFilters: false,
  });
  cursor++;

  cursor = renderPivotSection(ws, cursor, 2, {
    subhead: "일자별 데이터",
    labelHeader: "일자 구분",
    groups: pivot.daily,
    showFilters: false,
  });

  return { rowCount: cursor - 1 };
}

function writeKeywordPerformance(
  wb: ExcelJS.Workbook,
  pivot: ListPivot,
  hasData: boolean,
): { rowCount: number } {
  return writeListPivotSheet(
    wb,
    "키워드 성과",
    "■ 키워드별 성과",
    "키워드",
    pivot,
    hasData,
    WIDTHS_KEYWORD,
  );
}

function writeProductPerformance(
  wb: ExcelJS.Workbook,
  pivot: ProductPivot,
  hasData: boolean,
): { rowCount: number } {
  const state: "visible" | "hidden" = hasData ? "visible" : "hidden";
  const ws = wb.addWorksheet("상품 성과", { state });
  setColumnWidths(ws, WIDTHS_PRODUCT);

  const title = ws.getRow(2).getCell(2);
  title.value = "■ 쇼핑검색 상품별 성과";
  applyStyle(title, {
    font: FONT_MALGUN_9_BOLD,
    fill: FILL_TITLE,
    border: BORDER_THIN,
    alignment: { vertical: "middle" },
  });

  // Filter rows r4-5
  for (let i = 0; i < 2; i++) {
    const labelCell = ws.getRow(4 + i).getCell(2);
    labelCell.value = i === 0 ? "월별" : "주차";
    applyStyle(labelCell, {
      font: FONT_MALGUN_9,
      border: BORDER_THIN,
      alignment: { vertical: "middle" },
    });
    const valCell = ws.getRow(4 + i).getCell(3);
    valCell.value = "(모두)";
    applyStyle(valCell, {
      font: FONT_MALGUN_9,
      border: BORDER_THIN,
      alignment: { vertical: "middle" },
    });
  }

  // Header row 7: 상품ID, 상품명, 광고비..., 평균노출순위 (12 cols, B-M)
  const PROD_HEADERS = ["상품ID", "상품명", ...HEADER_LABELS_PIVOT];
  const headerRow = ws.getRow(7);
  for (let i = 0; i < PROD_HEADERS.length; i++) {
    const cell = headerRow.getCell(2 + i);
    cell.value = PROD_HEADERS[i]!;
    applyStyle(cell, {
      font: FONT_MALGUN_9,
      border: BORDER_THIN,
      alignment: pivotHeaderAlignment(i),
    });
  }

  // (비어 있음) row 8: B="(비어 있음)", C="(비어 있음)", D-L=zero metrics
  writeProductRow(ws, 8, "(비어 있음)", "(비어 있음)", ZERO_METRICS);

  // Data rows from row 9
  let cursor = 9;
  for (const item of pivot.items) {
    writeProductRow(ws, cursor, item.productId, item.productName, item.metrics);
    cursor++;
  }

  return { rowCount: cursor - 1 };
}

function writeProductRow(
  ws: Worksheet,
  rowIdx: number,
  id: string,
  name: string,
  m: PivotMetrics,
): void {
  const row = ws.getRow(rowIdx);
  const values: (string | number)[] = [
    id,
    name,
    ...metricsToCells("", m).slice(1),
  ];
  for (let i = 0; i < values.length; i++) {
    const cell = row.getCell(2 + i);
    cell.value = values[i]!;
    const align: Partial<ExcelJS.Alignment> =
      i <= 1
        ? { horizontal: "left", vertical: "middle" }
        : { vertical: "middle" };
    // numFmt offsets shift by 1 (extra "상품명" col before metrics)
    const nfIdx = i === 0 ? 0 : i - 1;
    applyStyle(cell, {
      font: FONT_MALGUN_9,
      border: BORDER_THIN,
      alignment: align,
      numFmt: METRIC_NF[nfIdx] ?? undefined,
    });
  }
}

function writeSearchTermPerformance(
  wb: ExcelJS.Workbook,
  pivot: ListPivot,
  hasData: boolean,
): { rowCount: number } {
  // Note: 검색어 성과 has filter at r5-r6 (not r4-r5) per reference.
  const state: "visible" | "hidden" = hasData ? "visible" : "hidden";
  const ws = wb.addWorksheet("검색어 성과", { state });
  setColumnWidths(ws, WIDTHS_SEARCH_TERM);

  const title = ws.getRow(2).getCell(2);
  title.value = "■ 쇼핑검색 검색어 성과 (전환 1건 이상 발생 검색어 대상)";
  applyStyle(title, {
    font: FONT_MALGUN_9_BOLD,
    fill: FILL_TITLE,
    border: BORDER_THIN,
    alignment: { vertical: "middle" },
  });

  for (let i = 0; i < 2; i++) {
    const r = 5 + i;
    const labelCell = ws.getRow(r).getCell(2);
    labelCell.value = i === 0 ? "월별" : "주차";
    applyStyle(labelCell, {
      font: FONT_MALGUN_9,
      border: BORDER_THIN,
      alignment: { vertical: "middle" },
    });
    const valCell = ws.getRow(r).getCell(3);
    valCell.value = "(모두)";
    applyStyle(valCell, {
      font: FONT_MALGUN_9,
      border: BORDER_THIN,
      alignment: { vertical: "middle" },
    });
  }

  const headerRow = ws.getRow(8);
  const headers = ["검색어", ...HEADER_LABELS_PIVOT];
  for (let i = 0; i < headers.length; i++) {
    const cell = headerRow.getCell(2 + i);
    cell.value = headers[i]!;
    applyStyle(cell, {
      font: FONT_MALGUN_9,
      border: BORDER_THIN,
      alignment: pivotHeaderAlignment(i),
    });
  }

  writeMetricRow(ws, 9, 2, "(비어 있음)", ZERO_METRICS);
  let cursor = 10;
  for (const item of pivot.items) {
    writeMetricRow(ws, cursor, 2, item.label, item.metrics);
    cursor++;
  }

  return { rowCount: cursor - 1 };
}

function writeListPivotSheet(
  wb: ExcelJS.Workbook,
  sheetName: string,
  title: string,
  labelHeader: string,
  pivot: ListPivot,
  hasData: boolean,
  widths: ReadonlyArray<number | null>,
): { rowCount: number } {
  const state: "visible" | "hidden" = hasData ? "visible" : "hidden";
  const ws = wb.addWorksheet(sheetName, { state });
  setColumnWidths(ws, widths);

  const titleCell = ws.getRow(2).getCell(2);
  titleCell.value = title;
  applyStyle(titleCell, {
    font: FONT_MALGUN_9_BOLD,
    fill: FILL_TITLE,
    border: BORDER_THIN,
    alignment: { vertical: "middle" },
  });

  // Filter rows r4-5
  for (let i = 0; i < 2; i++) {
    const r = 4 + i;
    const labelCell = ws.getRow(r).getCell(2);
    labelCell.value = i === 0 ? "월별" : "주차";
    applyStyle(labelCell, {
      font: FONT_MALGUN_9,
      border: BORDER_THIN,
      alignment: { vertical: "middle" },
    });
    const valCell = ws.getRow(r).getCell(3);
    valCell.value = "(모두)";
    applyStyle(valCell, {
      font: FONT_MALGUN_9,
      border: BORDER_THIN,
      alignment: { vertical: "middle" },
    });
  }

  // Header row 7
  const headerRow = ws.getRow(7);
  const headers = [labelHeader, ...HEADER_LABELS_PIVOT];
  for (let i = 0; i < headers.length; i++) {
    const cell = headerRow.getCell(2 + i);
    cell.value = headers[i]!;
    applyStyle(cell, {
      font: FONT_MALGUN_9,
      border: BORDER_THIN,
      alignment: pivotHeaderAlignment(i),
    });
  }

  writeMetricRow(ws, 8, 2, "(비어 있음)", ZERO_METRICS);
  let cursor = 9;
  for (const item of pivot.items) {
    writeMetricRow(ws, cursor, 2, item.label, item.metrics);
    cursor++;
  }

  return { rowCount: cursor - 1 };
}

// ---------------------------------------------------------------------------
// Brand search sheet — static placeholder layout (API-unsupported).
// ---------------------------------------------------------------------------

const BRAND_AREAS = [
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

function writeBrandSearch(wb: ExcelJS.Workbook): { rowCount: number } {
  const ws = wb.addWorksheet("브랜드검색 성과", { state: "hidden" });
  setColumnWidths(ws, WIDTHS_BRAND);

  // Title row 2
  const title = ws.getRow(2).getCell(2);
  title.value = "■ 브랜드검색 소재 영역별 성과 (수기 입력 필요)";
  applyStyle(title, {
    font: FONT_MALGUN_9_BOLD,
    fill: FILL_TITLE,
    border: BORDER_THIN,
    alignment: { vertical: "middle" },
  });

  // 광고 소재 subhead row 4
  const subhead1 = ws.getRow(4).getCell(2);
  subhead1.value = "광고 소재";
  applyStyle(subhead1, {
    font: FONT_MALGUN_9,
    fill: FILL_SECTION,
    border: BORDER_THIN,
    alignment: { vertical: "middle" },
  });

  // 영역별 성과 subhead row 18
  const subhead2 = ws.getRow(18).getCell(2);
  subhead2.value = "영역별 성과";
  applyStyle(subhead2, {
    font: FONT_MALGUN_9,
    fill: FILL_SECTION,
    border: BORDER_THIN,
    alignment: { vertical: "middle" },
  });

  // Header row 19: B-F = PC half, H-L = MO half
  const HEADERS = ["소재 구분", "영역", "노출수", "클릭수", "CTR"];
  for (let i = 0; i < HEADERS.length; i++) {
    const left = ws.getRow(19).getCell(2 + i);
    left.value = HEADERS[i]!;
    applyStyle(left, {
      font: FONT_MALGUN_9,
      border: BORDER_THIN,
      alignment: { horizontal: "center", vertical: "middle" },
    });
    const right = ws.getRow(19).getCell(8 + i);
    right.value = HEADERS[i]!;
    applyStyle(right, {
      font: FONT_MALGUN_9,
      border: BORDER_THIN,
      alignment: { horizontal: "center", vertical: "middle" },
    });
  }

  // TOTAL row 20 (B20:C20, H20:I20 merged in reference)
  ws.mergeCells("B20:C20");
  ws.mergeCells("H20:I20");
  const total = ws.getRow(20);
  for (const col of [2, 8]) {
    const c = total.getCell(col);
    c.value = "TOTAL";
    applyStyle(c, {
      font: FONT_MALGUN_9,
      border: BORDER_THIN,
      alignment: { vertical: "middle" },
    });
  }
  // Sum formula in noise/CTR cols
  total.getCell(4).value = 0;
  applyStyle(total.getCell(4), {
    font: FONT_MALGUN_9,
    border: BORDER_THIN,
    numFmt: NF_INT_ACCT,
  });
  total.getCell(5).value = { formula: "SUM(E21:E30)" };
  applyStyle(total.getCell(5), {
    font: FONT_MALGUN_9,
    border: BORDER_THIN,
    numFmt: NF_INT_ACCT,
  });
  total.getCell(6).value = { formula: "IFERROR((E20/$D$20),0)" };
  applyStyle(total.getCell(6), {
    font: FONT_MALGUN_9,
    border: BORDER_THIN,
    numFmt: NF_PCT,
  });
  total.getCell(10).value = 0;
  applyStyle(total.getCell(10), {
    font: FONT_MALGUN_9,
    border: BORDER_THIN,
    numFmt: NF_INT_ACCT,
  });
  total.getCell(11).value = { formula: "SUM(K21:K30)" };
  applyStyle(total.getCell(11), {
    font: FONT_MALGUN_9,
    border: BORDER_THIN,
    numFmt: NF_INT_ACCT,
  });
  total.getCell(12).value = { formula: "IFERROR((K20/$J$20),0)" };
  applyStyle(total.getCell(12), {
    font: FONT_MALGUN_9,
    border: BORDER_THIN,
    numFmt: NF_PCT,
  });

  // Area rows 21-30
  for (let i = 0; i < BRAND_AREAS.length; i++) {
    const r = 21 + i;
    const row = ws.getRow(r);
    row.getCell(3).value = BRAND_AREAS[i]!;
    row.getCell(9).value = BRAND_AREAS[i]!;
    row.getCell(6).value = { formula: `IFERROR((E${r}/$D$20),0)` };
    row.getCell(12).value = { formula: `IFERROR((K${r}/$J$20),0)` };
    applyStyle(row.getCell(6), { numFmt: NF_PCT });
    applyStyle(row.getCell(12), { numFmt: NF_PCT });
  }

  return { rowCount: 30 };
}

// ---------------------------------------------------------------------------
// RAW sheets
// ---------------------------------------------------------------------------

const NUMERIC_RAW_HEADERS = new Set([
  "광고비 (VAT-).",
  "노출수.",
  "클릭수.",
  "구매완료.",
  "회원가입.",
  "신청완료.",
  "기타전환.",
  "전환매출액.",
]);
const DECIMAL_RAW_HEADER = "평균노출순위.";
const DATE_RAW_HEADER = "날짜.";

function writeRawSheet(
  wb: ExcelJS.Workbook,
  name: string,
  headers: string[],
  rows: RawRowBase[],
  state: "visible" | "hidden",
  isMaterial: boolean,
): { rowCount: number } {
  const ws = wb.addWorksheet(name, { state });

  // Column widths
  if (isMaterial) {
    setColumnWidths(ws, WIDTHS_MATERIAL_RAW);
  } else {
    // Date column = 11.125 only
    const widths: (number | null)[] = headers.map(() => null);
    const dateIdx = headers.indexOf(DATE_RAW_HEADER);
    if (dateIdx >= 0) widths[dateIdx] = WIDTH_DATE_RAW;
    setColumnWidths(ws, widths);
  }

  // Header row
  const headerRow = ws.getRow(1);
  for (let i = 0; i < headers.length; i++) {
    const cell = headerRow.getCell(i + 1);
    cell.value = headers[i]!;
    if (isMaterial) {
      // Reference applies font + border + fill on 소재RAW header
      applyStyle(cell, {
        font: FONT_MALGUN_9,
        fill: CONV_COLUMNS.has(headers[i]!)
          ? FILL_CONV
          : ({
              type: "pattern",
              pattern: "none",
            } as ExcelJS.Fill),
        border: BORDER_THIN,
        alignment: { vertical: "middle" },
      });
    }
    // Other RAW sheets keep plain headers (matches reference).
  }

  // Data rows
  for (let r = 0; r < rows.length; r++) {
    const row = ws.getRow(r + 2);
    for (let i = 0; i < headers.length; i++) {
      const header = headers[i]!;
      const key = stripDot(header);
      const raw = (rows[r] as unknown as Record<string, unknown>)[key] ?? null;
      const cell = row.getCell(i + 1);

      if (header === DATE_RAW_HEADER && typeof raw === "string") {
        cell.value = parseLocalDate(raw);
        applyStyle(cell, {
          font: FONT_MALGUN_11,
          border: BORDER_THIN,
          alignment: { vertical: "middle" },
          numFmt: NF_DATE_RAW,
        });
      } else if (header === DECIMAL_RAW_HEADER) {
        cell.value = typeof raw === "number" ? raw : 0;
        applyStyle(cell, {
          font: FONT_MALGUN_11,
          border: BORDER_THIN,
          numFmt: NF_DEC2_RAW,
        });
      } else if (NUMERIC_RAW_HEADERS.has(header)) {
        cell.value = typeof raw === "number" ? raw : 0;
        applyStyle(cell, {
          font: FONT_MALGUN_11,
          border: BORDER_THIN,
          numFmt: NF_INT_RAW,
        });
      } else {
        cell.value = raw as ExcelJS.CellValue;
      }
    }
  }

  return { rowCount: rows.length + 1 };
}

function parseLocalDate(s: string): Date {
  // "2026-02-06" → Date at local 00:00:00. Excel stores as serial number.
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y!, (m ?? 1) - 1, d ?? 1);
}

// ---------------------------------------------------------------------------
// Public entry
// ---------------------------------------------------------------------------

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

  // Sheet 1
  {
    const r = writeSummary(wb, data.pivotSummary);
    record("SUMMARY", "visible", r.rowCount);
  }

  // Sheet 2
  {
    const r = writeMediaPerformance(wb, data.pivotMedia);
    record(
      "매체별 성과",
      data.pivotMedia.hidden ? "hidden" : "visible",
      r.rowCount,
    );
  }

  // Sheet 3 — 키워드 성과 (visible if rawKeyword has data)
  {
    const hasData = data.rawKeyword.length > 0;
    const r = writeKeywordPerformance(wb, data.pivotKeyword, hasData);
    record("키워드 성과", hasData ? "visible" : "hidden", r.rowCount);
  }

  // Sheet 4 — 상품 성과 (hidden if no material)
  {
    const hasData = data.rawMaterial.length > 0;
    const r = writeProductPerformance(wb, data.pivotProduct, hasData);
    record("상품 성과", hasData ? "visible" : "hidden", r.rowCount);
  }

  // Sheet 5 — 검색어 성과 (hidden if no search-term raw)
  {
    const hasData = data.rawSearchTerm.length > 0;
    const r = writeSearchTermPerformance(wb, data.pivotSearchTerm, hasData);
    record("검색어 성과", hasData ? "visible" : "hidden", r.rowCount);
  }

  // Sheet 6 — 브랜드검색 성과 (always hidden)
  {
    const r = writeBrandSearch(wb);
    record("브랜드검색 성과", "hidden", r.rowCount);
  }

  // Sheet 7 — 소재RAW
  {
    const state: "visible" | "hidden" =
      data.rawMaterial.length > 0 ? "visible" : "hidden";
    const r = writeRawSheet(
      wb,
      "소재RAW",
      HEADERS_MATERIAL_RAW,
      data.rawMaterial,
      state,
      true,
    );
    record("소재RAW", state, r.rowCount);
  }

  // Sheet 8 — 검색어RAW
  {
    const state: "visible" | "hidden" =
      data.rawSearchTerm.length > 0 ? "visible" : "hidden";
    const r = writeRawSheet(
      wb,
      "검색어RAW",
      HEADERS_SEARCH_TERM_RAW,
      data.rawSearchTerm,
      state,
      false,
    );
    record("검색어RAW", state, r.rowCount);
  }

  // Sheet 9 — 일별RAW
  {
    const r = writeRawSheet(
      wb,
      "일별RAW",
      HEADERS_DAILY_RAW,
      data.rawDaily,
      "visible",
      false,
    );
    record("일별RAW", "visible", r.rowCount);
  }

  // Sheet 10 — 키워드RAW
  {
    const r = writeRawSheet(
      wb,
      "키워드RAW",
      HEADERS_KEYWORD_RAW,
      data.rawKeyword,
      "visible",
      false,
    );
    record("키워드RAW", "visible", r.rowCount);
  }

  await wb.xlsx.writeFile(outputPath);
  return { path: outputPath, sheetNames, visibility, rowCount };
}
