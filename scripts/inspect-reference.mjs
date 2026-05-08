#!/usr/bin/env node
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

function summarizeCell(cell) {
  return {
    addr: cell.address,
    type: cell.type,
    value: cell.value,
    numFmt: cell.numFmt ?? null,
    fill: cell.fill ?? null,
    font: cell.font ?? null,
    alignment: cell.alignment ?? null,
    border: cell.border ? "yes" : null,
  };
}

const wb = new ExcelJS.Workbook();
await wb.xlsx.readFile(REF);

console.log("=== Workbook ===");
console.log("Sheet count:", wb.worksheets.length);
console.log();

for (const ws of wb.worksheets) {
  console.log(`\n=== Sheet: "${ws.name}" (state=${ws.state}, rows=${ws.rowCount}, cols=${ws.columnCount}) ===`);

  // Merged cells
  const merged = ws.model?.merges ?? [];
  if (merged.length > 0) {
    console.log("  merged:", merged.slice(0, 10), merged.length > 10 ? `... (${merged.length} total)` : "");
  }

  // Up to first 6 rows
  const limit = Math.min(ws.rowCount, 6);
  for (let r = 1; r <= limit; r++) {
    const row = ws.getRow(r);
    const cells = [];
    row.eachCell({ includeEmpty: false }, (cell) => {
      cells.push(summarizeCell(cell));
    });
    if (cells.length === 0) continue;
    console.log(`  row ${r} (count=${row.cellCount}):`);
    for (const c of cells.slice(0, 25)) {
      console.log("   ", JSON.stringify(c));
    }
    if (cells.length > 25) console.log(`    ... +${cells.length - 25} more`);
  }

  // Column widths
  const widths = [];
  for (let c = 1; c <= Math.min(ws.columnCount, 25); c++) {
    const col = ws.getColumn(c);
    widths.push(col.width ?? null);
  }
  console.log("  column widths (first 25):", widths);

  // Check if rows beyond 6 carry data — peek at a middle row
  const mid = Math.min(ws.rowCount, 12);
  if (mid > limit) {
    const row = ws.getRow(mid);
    const cells = [];
    row.eachCell({ includeEmpty: false }, (cell) => cells.push(summarizeCell(cell)));
    if (cells.length > 0) {
      console.log(`  row ${mid} sample:`);
      for (const c of cells.slice(0, 25)) console.log("   ", JSON.stringify(c));
    }
  }
}
