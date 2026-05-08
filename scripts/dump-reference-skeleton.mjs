#!/usr/bin/env node
// Print only structural skeleton rows (section headers, filter rows, totals,
// "(비어 있음)" markers, "■" titles, header rows) so we can see the layout
// across the full row range without drowning in data rows.

import ExcelJS from "exceljs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REF = path.resolve(
  __dirname,
  "..",
  "docs",
  "references",
  "1778140340186_(FORM) helloMAX Report_신청완료.xlsx",
);

const wb = new ExcelJS.Workbook();
await wb.xlsx.readFile(REF);

function isStructural(row) {
  let result = false;
  let allText = "";
  row.eachCell({ includeEmpty: false }, (c) => {
    const v = c.value;
    if (typeof v === "string") {
      allText += v + " | ";
      if (
        v.startsWith("■") ||
        v === "(모두)" ||
        v === "(비어 있음)" ||
        v === "총합계" ||
        v === "월별" ||
        v === "주차" ||
        v === "월별 데이터" ||
        v === "주차별 데이터" ||
        v.endsWith("성과") ||
        v === "월 구분" ||
        v === "주차 구분" ||
        v === "광고 소재"
      ) {
        result = true;
      }
    }
    // Theme5 tint = section subhead
    if (c.fill?.fgColor?.theme === 5) result = true;
    // FFE5ECFF = title fill
    if (c.fill?.fgColor?.argb === "FFE5ECFF") result = true;
    // Yellow conv-column fill
    if (c.fill?.fgColor?.argb === "FFFFFF00") result = true;
  });
  return { structural: result, snippet: allText.slice(0, 200) };
}

for (const ws of wb.worksheets) {
  console.log(`\n### "${ws.name}" rows=${ws.rowCount} cols=${ws.columnCount} ###`);
  const merges = ws.model?.merges ?? [];
  if (merges.length) console.log("MERGES:", merges);
  const widths = [];
  for (let c = 1; c <= ws.columnCount; c++) widths.push(ws.getColumn(c).width ?? null);
  console.log("WIDTHS:", widths);

  ws.eachRow({ includeEmpty: false }, (row, rowNum) => {
    const { structural, snippet } = isStructural(row);
    if (!structural && rowNum > 1) return;
    // Print row's cells (values + numFmt + fill summary)
    const cellInfo = [];
    row.eachCell({ includeEmpty: false }, (c) => {
      const v = c.value instanceof Date ? `Date(${c.value.toISOString()})` : c.value;
      const fill = c.fill?.fgColor;
      const fillKey = fill
        ? fill.argb
          ? fill.argb
          : fill.theme !== undefined
            ? `theme${fill.theme}/${fill.tint?.toFixed(2) ?? "?"}`
            : "?"
        : "";
      cellInfo.push(
        `${c.address}=${JSON.stringify(v)}${c.numFmt ? `[${c.numFmt}]` : ""}${fillKey ? `{${fillKey}}` : ""}`,
      );
    });
    console.log(`r${rowNum}:`, cellInfo.join("  "));
  });
}
