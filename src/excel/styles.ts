// Reference-template style constants. Mirrors
// `docs/references/1778140340186_(FORM) helloMAX Report_신청완료.xlsx`.

import ExcelJS from "exceljs";
import type { Borders, Fill, Font } from "exceljs";

// ---------------------------------------------------------------------------
// Number formats (raw Excel format strings — must match reference exactly)
// ---------------------------------------------------------------------------

export const NF_INT_ACCT = '_-* #,##0_-;-* #,##0_-;_-* "-"_-;_-@_-';
export const NF_DEC1_ACCT = '_-* #,##0.0_-;-* #,##0.0_-;_-* "-"_-;_-@_-';
export const NF_PCT = "0.00%";
export const NF_INT_RAW = "#,##0";
export const NF_DEC2_RAW = "#,##0.00";
export const NF_DATE_RAW = "mm-dd-yy";

// ---------------------------------------------------------------------------
// Fills
// ---------------------------------------------------------------------------

export const FILL_TITLE: Fill = {
  type: "pattern",
  pattern: "solid",
  fgColor: { argb: "FFE5ECFF" },
  bgColor: { argb: "FFE5ECFF" },
};

// Reference uses theme color (theme:5, tint:0.7999...). ExcelJS' Color type
// only declares argb/indexed/theme, but the engine accepts `tint` too. We
// cast through `as Fill` so the runtime value reaches the writer unchanged.
export const FILL_SECTION: Fill = {
  type: "pattern",
  pattern: "solid",
  fgColor: { theme: 5, tint: 0.7999816888943144 } as unknown as ExcelJS.Color,
  bgColor: { argb: "FFFFFFFF" },
};

export const FILL_CONV: Fill = {
  type: "pattern",
  pattern: "solid",
  fgColor: { argb: "FFFFFF00" },
  bgColor: { argb: "FFFFFF00" },
};

// ---------------------------------------------------------------------------
// Fonts
// ---------------------------------------------------------------------------

export const FONT_MALGUN_9: Partial<Font> = {
  name: "맑은 고딕",
  size: 9,
  family: 3,
  charset: 129,
  scheme: "minor",
  color: { theme: 1 } as ExcelJS.Color,
};

export const FONT_MALGUN_9_BOLD: Partial<Font> = {
  ...FONT_MALGUN_9,
  bold: true,
};

export const FONT_TITLE_25: Partial<Font> = {
  ...FONT_MALGUN_9,
  bold: true,
  size: 25,
};

export const FONT_MALGUN_11: Partial<Font> = {
  name: "맑은 고딕",
  size: 11,
  family: 2,
  charset: 129,
  scheme: "minor",
  color: { theme: 1 } as ExcelJS.Color,
};

// ---------------------------------------------------------------------------
// Borders
// ---------------------------------------------------------------------------

export const BORDER_THIN: Partial<Borders> = {
  top: { style: "thin" },
  left: { style: "thin" },
  bottom: { style: "thin" },
  right: { style: "thin" },
};

// ---------------------------------------------------------------------------
// Column widths (per sheet, 1-based — index 0 is unused)
// ---------------------------------------------------------------------------

export const WIDTHS_SUMMARY = [
  3.625, 11.75, 11.125, 9, 9, 9, 9, 9.125, 10.5, 10.375, 10.5,
];
export const WIDTHS_MEDIA = [
  3.625, 13, 11.125, 9, 9, 9, 9, 9, 10.5, 10.375, 10.5,
];
export const WIDTHS_KEYWORD = [
  3.625, 23.875, 11.125, 9, 9, 9, 9, 9, 10.5, 10.375, 10.5,
];
export const WIDTHS_PRODUCT = [
  3.625, 15.625, 40.625, 11.125, 9, 9, 9, 9, 9, 10.5, 10.375, 10.5,
];
export const WIDTHS_SEARCH_TERM = [
  3.625, 23.875, 11.125, 9, 9, 9, 9, 9, 10.5, 10.375, 10.5,
];
export const WIDTHS_BRAND = [3.625, 9, 23, 9, 9, 9, 9, 9, 23, 9, 9, 9];

// 소재RAW: column J = "네이버 쇼핑 상품 ID" gets 11.25, 날짜 (col C) = 9.75
export const WIDTHS_MATERIAL_RAW = [
  9, 9, 9.75, 9, 9, 9, 9, 9, 9, 11.25, 9, 9, 9, 9, 9, 9, 9, 9, 9, 9,
];

// 일별RAW / 키워드RAW only set 날짜 column (3rd col) to 11.125
export const WIDTH_DATE_RAW = 11.125;
