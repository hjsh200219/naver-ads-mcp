#!/usr/bin/env node
// Dump every row's structural skeleton (values + numFmt + fill) so we can
// reverse-engineer the layout of each sheet without parsing 92K-row data tables.
//
// For pivot/title sheets we dump rows 1..50 (or end). For RAW we just dump
// rows 1..3 since their structure is straightforward.

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

const SCAN_LIMITS = {
  SUMMARY: 50,
  "매체별 성과": 50,
  "키워드 성과": 20,
  "상품 성과": 20,
  "검색어 성과": 20,
  "브랜드검색 성과": 30,
  "일별RAW": 3,
  "키워드RAW": 3,
  "검색어RAW": 2,
  "소재RAW": 2,
};

function styleKey(c) {
  return JSON.stringify({
    nf: c.numFmt ?? null,
    fill: c.fill?.fgColor ?? null,
    font: c.font ? { name: c.font.name, size: c.font.size, bold: c.font.bold ?? false } : null,
    bold: c.font?.bold ?? false,
    border: c.border ? "Y" : null,
    align: c.alignment ? `${c.alignment.horizontal ?? ""}/${c.alignment.vertical ?? ""}` : null,
  });
}

const wb = new ExcelJS.Workbook();
await wb.xlsx.readFile(REF);

for (const ws of wb.worksheets) {
  const limit = SCAN_LIMITS[ws.name] ?? 5;
  console.log(`\n=== "${ws.name}" (state=${ws.state}, rows=${ws.rowCount}, cols=${ws.columnCount}) ===`);
  const merges = ws.model?.merges ?? [];
  if (merges.length) console.log("merges:", merges);

  // Column widths (all)
  const widths = [];
  for (let c = 1; c <= ws.columnCount; c++) widths.push(ws.getColumn(c).width ?? null);
  console.log("widths:", widths);

  for (let r = 1; r <= Math.min(ws.rowCount, limit); r++) {
    const row = ws.getRow(r);
    const cells = [];
    row.eachCell({ includeEmpty: false }, (c) => {
      cells.push({
        a: c.address,
        v: c.value instanceof Date ? `Date(${c.value.toISOString()})` : c.value,
        s: styleKey(c),
      });
    });
    if (cells.length === 0) continue;
    console.log(`r${r} (h=${row.height ?? "auto"}):`);
    for (const c of cells) {
      console.log(`  ${c.a}=${JSON.stringify(c.v)} ${c.s}`);
    }
  }
}
