#!/usr/bin/env node
// Live end-to-end smoke: runs generate_report against the real Naver API for
// the default account and inspects the resulting xlsx's 일별RAW for non-zero
// data — the discriminating proof that parseTsv no longer silently corrupts.

import { readFileSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import ExcelJS from "exceljs";
import { NaverAdsClient } from "../dist/api/client.js";
import { freezeCredential } from "../dist/config/credentials.js";
import { createServer } from "../dist/mcp/server.js";
import { MapAccountStore } from "../dist/config/account-store.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");

function pickRange() {
  const start = process.argv[2] && /^\d{8}$/.test(process.argv[2])
    ? process.argv[2]
    : "20260512";
  const end = process.argv[3] && /^\d{8}$/.test(process.argv[3])
    ? process.argv[3]
    : start;
  return { start, end };
}

function loadAccount() {
  const raw = JSON.parse(readFileSync(resolve(ROOT, "accounts.json"), "utf-8"));
  const name = process.argv[4] ?? raw.default;
  const entry = raw.accounts[name];
  if (!entry) throw new Error(`account not found: ${name}`);
  return {
    name,
    cred: freezeCredential(
      String(entry.customerId),
      entry.accessLicense,
      entry.secretKey,
    ),
  };
}

async function main() {
  const { start, end } = pickRange();
  const { name, cred } = loadAccount();
  console.error(`# live generate_report account=${name} range=${start}..${end}`);

  const client = new NaverAdsClient({
    baseUrl: "https://api.searchad.naver.com",
    credentials: cred,
  });

  const accountStore = new MapAccountStore({
    defaultName: name,
    accounts: new Map([[name, cred]]),
  });

  const { tools } = createServer({
    client,
    accountStore,
  });

  const tmpDir = mkdtempSync(join(tmpdir(), "live-gen-"));
  const outputPath = join(tmpDir, "report.xlsx");
  try {
    const result = await tools.generate_report({
      startDate: start,
      endDate: end,
      outputPath,
      account: name,
    });
    console.error(`# wrote ${result.path}`);
    console.error(`# sheets: ${result.sheetNames.join(", ")}`);

    const wb = new ExcelJS.Workbook();
    await wb.xlsx.readFile(outputPath);
    const ws = wb.getWorksheet("일별RAW");
    if (!ws) throw new Error("일별RAW missing");

    console.error(`\n## 일별RAW rows=${ws.rowCount}, cols=${ws.columnCount}`);
    const header = ws.getRow(1).values;
    console.error(`# header: ${JSON.stringify(header)}`);

    // First 3 data rows
    for (let r = 2; r <= Math.min(ws.rowCount, 5); r++) {
      const row = ws.getRow(r).values;
      console.error(`# row${r}: ${JSON.stringify(row)}`);
    }

    // Aggregate numerics
    let totImp = 0;
    let totClk = 0;
    let totSales = 0;
    let totConv = 0;
    let unknownCount = 0;
    const impIdx = 10; // 광고비 col9, 노출수 col10
    for (let r = 2; r <= ws.rowCount; r++) {
      const row = ws.getRow(r);
      const sales = Number(row.getCell(9).value) || 0;
      const imp = Number(row.getCell(10).value) || 0;
      const clk = Number(row.getCell(11).value) || 0;
      const conv =
        (Number(row.getCell(12).value) || 0) +
        (Number(row.getCell(13).value) || 0) +
        (Number(row.getCell(14).value) || 0) +
        (Number(row.getCell(15).value) || 0);
      totSales += sales;
      totImp += imp;
      totClk += clk;
      totConv += conv;
      const camp = String(row.getCell(6).value ?? "");
      if (camp === "unknown") unknownCount++;
    }
    console.error(`\n## totals: imp=${totImp} clk=${totClk} sales=${totSales} conv=${totConv}`);
    console.error(`## rows with 캠페인="unknown": ${unknownCount} / ${ws.rowCount - 1}`);
    if (totImp === 0 && totClk === 0) {
      console.error("FAIL: all zeros — parseTsv corruption still present");
      process.exit(1);
    }
    if (unknownCount === ws.rowCount - 1) {
      console.error("FAIL: every campaign label is 'unknown' — lookup broken");
      process.exit(1);
    }
    console.error("OK: 일별RAW populated with non-zero data");
  } finally {
    rmSync(tmpDir, { recursive: true, force: true });
  }
}

main().catch((e) => {
  console.error("FATAL:", e);
  process.exit(1);
});
