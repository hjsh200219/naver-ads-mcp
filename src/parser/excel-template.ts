// L2 service: helloMAX Report (FORM) xlsx parser.
//
// Reads the `일별RAW` sheet — a 17-column daily breakdown that all 6
// advertisers share when AE uploads via the helloMAX form. Returns rows in
// the same shape as src/raw/builder.ts#RawRowBase so downstream aggregation
// can reuse existing date helpers.
//
// Three-stage parsing (per AI plan v2.0):
//   1. Header detection by exact name match (after stripping trailing dot).
//   2. Cell coercion: numbers → number, dates → ISO yyyy-mm-dd, sentinels → 0.
//   3. (Out of scope here) AE manual mapping + AI-assisted column inference.
//
// Layer rule: this is L2 (service). File IO via exceljs is allowed because
// L2 may import L3-level deps; parser does not touch network.

import ExcelJS from "exceljs";

const REQUIRED_HEADERS = [
  "월별",
  "주차",
  "날짜",
  "매체",
  "캠페인유형",
  "캠페인",
  "광고그룹",
  "디바이스",
  "광고비 (VAT-)",
  "노출수",
  "클릭수",
  "구매완료",
  "회원가입",
  "신청완료",
  "기타전환",
  "전환매출액",
  "평균노출순위",
] as const;

type RequiredHeader = (typeof REQUIRED_HEADERS)[number];

const NUMERIC_COLUMNS: ReadonlySet<string> = new Set([
  "광고비 (VAT-)",
  "노출수",
  "클릭수",
  "구매완료",
  "회원가입",
  "신청완료",
  "기타전환",
  "전환매출액",
  "평균노출순위",
]);

export interface DailyRawJsonRow {
  월별: string;
  주차: string;
  날짜: string;
  매체: string;
  캠페인유형: string;
  캠페인: string;
  광고그룹: string;
  디바이스: "PC" | "MO" | string;
  "광고비 (VAT-)": number;
  노출수: number;
  클릭수: number;
  구매완료: number;
  회원가입: number;
  신청완료: number;
  기타전환: number;
  전환매출액: number;
  평균노출순위: number;
  // Allow extra columns to pass through without error (forward compatibility).
  [k: string]: unknown;
}

export class ExcelParseError extends Error {
  constructor(message: string) {
    super(`Excel parse: ${message}`);
    this.name = "ExcelParseError";
  }
}

export async function parseHelloMaxXlsx(
  filePath: string,
  sheetName = "일별RAW",
): Promise<DailyRawJsonRow[]> {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(filePath);
  const sheet = wb.getWorksheet(sheetName);
  if (!sheet) {
    throw new ExcelParseError(`Sheet not found: ${sheetName}`);
  }
  // Materialize the sheet as a 2D array so the pure logic in
  // parseDailyRawSheet can be unit-tested without an xlsx round-trip.
  const sheetData: unknown[][] = [];
  sheet.eachRow({ includeEmpty: false }, (row) => {
    const arr: unknown[] = [];
    row.eachCell({ includeEmpty: true }, (cell, col) => {
      let v: unknown = cell.value;
      if (v && typeof v === "object" && "result" in v) {
        v = (v as { result: unknown }).result;
      }
      if (v && typeof v === "object" && "text" in v) {
        v = (v as { text: unknown }).text;
      }
      if (v instanceof Date) {
        v = isoDate(v);
      }
      arr[col - 1] = v;
    });
    sheetData.push(arr);
  });
  return parseDailyRawSheet(sheetData);
}

/**
 * Pure, unit-testable parser. Takes a 2D cell array (rows × cols) and returns
 * normalized DailyRawJsonRow[]. Header row must be the first non-empty row.
 */
export function parseDailyRawSheet(sheetData: unknown[][]): DailyRawJsonRow[] {
  if (!Array.isArray(sheetData) || sheetData.length < 1) {
    throw new ExcelParseError("Empty sheet (no header row)");
  }
  const firstRow = sheetData[0];
  if (!Array.isArray(firstRow) || firstRow.length === 0) {
    throw new ExcelParseError("Empty sheet (no header row)");
  }
  const headerRow = firstRow.map((c) =>
    typeof c === "string" ? c.trim().replace(/\.$/, "") : String(c ?? ""),
  );
  const colIndex: Map<RequiredHeader, number> = new Map();
  for (const required of REQUIRED_HEADERS) {
    const idx = headerRow.indexOf(required);
    if (idx === -1) {
      throw new ExcelParseError(`Missing required column: ${required}`);
    }
    colIndex.set(required, idx);
  }
  const out: DailyRawJsonRow[] = [];
  for (let r = 1; r < sheetData.length; r++) {
    const row = sheetData[r];
    if (!row || row.every((v) => v === undefined || v === null || v === ""))
      continue;
    const obj: Record<string, unknown> = {};
    for (const key of REQUIRED_HEADERS) {
      const idx = colIndex.get(key);
      if (idx === undefined) continue;
      const raw = row[idx];
      if (NUMERIC_COLUMNS.has(key)) {
        obj[key] = coerceNumber(raw);
      } else if (key === "날짜") {
        obj[key] = coerceDate(raw);
      } else if (key === "디바이스") {
        const s = String(raw ?? "").toUpperCase();
        obj[key] = s;
      } else {
        obj[key] = String(raw ?? "");
      }
    }
    out.push(obj as DailyRawJsonRow);
  }
  return out;
}

function coerceNumber(v: unknown): number {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (v === null || v === undefined || v === "") return 0;
  const s = String(v).trim();
  if (s === "" || s === "#DIV/0!" || s === "#N/A" || s === "-") return 0;
  // Strip thousand separators and percent signs
  const cleaned = s.replace(/,/g, "").replace(/%$/, "");
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : 0;
}

function coerceDate(v: unknown): string {
  if (v instanceof Date) return isoDate(v);
  if (typeof v === "number") {
    // Excel serial date (days since 1899-12-30)
    const d = new Date(Date.UTC(1899, 11, 30) + v * 86_400_000);
    return isoDate(d);
  }
  const s = String(v ?? "").trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  // Try Date parsing as a fallback
  const parsed = new Date(s);
  if (!Number.isNaN(parsed.getTime())) return isoDate(parsed);
  return s;
}

function isoDate(d: Date): string {
  const yyyy = d.getUTCFullYear();
  const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(d.getUTCDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}
