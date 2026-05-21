#!/usr/bin/env node
// Verify AD reportTp column mapping by cross-checking against the synchronous
// /stats API. Picks the top adgroup by row count from a sample TSV, sums each
// numeric column across that adgroup's rows, and compares with /stats output.
//
// Usage: node scripts/verify-stat-columns.mjs [statDt YYYYMMDD] [account]
//
// Output: for each numeric column index in the TSV, prints the sum and which
// /stats field (impCnt, clkCnt, salesAmt, avgRnk, ccnt) matches.

import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

import { NaverAdsClient } from "../dist/api/client.js";
import { freezeCredential } from "../dist/config/credentials.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");

function pickStatDt() {
  return process.argv[2] && /^\d{8}$/.test(process.argv[2])
    ? process.argv[2]
    : "20260512";
}

function pickAccount() {
  const raw = JSON.parse(readFileSync(resolve(ROOT, "accounts.json"), "utf-8"));
  const name = process.argv[3] ?? raw.default;
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

function isoFromStatDt(s) {
  return `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}`;
}

function pickTopAdgroup(adTsvPath) {
  const text = readFileSync(adTsvPath, "utf-8");
  const rows = text
    .split("\n")
    .filter((l) => l.trim() !== "")
    .map((l) => l.split("\t"));
  const adgroupRows = new Map();
  for (const r of rows) {
    const g = r[3];
    if (!g) continue;
    if (!adgroupRows.has(g)) adgroupRows.set(g, []);
    adgroupRows.get(g).push(r);
  }
  let topId = null;
  let topCount = 0;
  for (const [g, rs] of adgroupRows) {
    if (rs.length > topCount) {
      topCount = rs.length;
      topId = g;
    }
  }
  return { adgroupId: topId, rows: adgroupRows.get(topId), allRows: rows };
}

function sumByCol(rows, colIdx) {
  let s = 0;
  for (const r of rows) {
    const v = Number(r[colIdx]);
    if (Number.isFinite(v)) s += v;
  }
  return s;
}

async function main() {
  const statDt = pickStatDt();
  const { name, cred } = pickAccount();
  const adTsvPath = resolve(ROOT, "scripts/samples", statDt, "AD.tsv");
  const { adgroupId, rows, allRows } = pickTopAdgroup(adTsvPath);
  if (!adgroupId) throw new Error(`no adgroup in ${adTsvPath}`);
  console.error(
    `# account=${name} statDt=${statDt} top-adgroup=${adgroupId} (${rows.length} rows)`,
  );

  // Per-column sums for the top adgroup
  const colCount = rows[0].length;
  console.log(`\n## TSV column sums for adgroup ${adgroupId} (${rows.length} rows)`);
  for (let i = 8; i <= colCount; i++) {
    const s = sumByCol(rows, i - 1);
    console.log(`  col${i}: sum=${s}, max=${Math.max(...rows.map((r) => Number(r[i - 1]) || 0))}`);
  }

  // Call /stats for the top adgroup
  const client = new NaverAdsClient({
    baseUrl: "https://api.searchad.naver.com",
    credentials: cred,
  });
  const iso = isoFromStatDt(statDt);
  const fields = [
    "impCnt",
    "clkCnt",
    "salesAmt",
    "ctr",
    "cpc",
    "avgRnk",
    "ccnt",
    "convAmt",
  ];
  const stats = await client.get("/stats", {
    ids: adgroupId,
    fields: JSON.stringify(fields),
    timeRange: JSON.stringify({ since: iso, until: iso }),
  });
  console.log(`\n## /stats response for adgroup ${adgroupId} on ${iso}`);
  console.log(JSON.stringify(stats, null, 2));

  // Per-column sums across ALL adgroups for the day (full TSV) for global verification
  console.log(`\n## Global TSV column sums (all ${allRows.length} AD rows)`);
  for (let i = 8; i <= colCount; i++) {
    const s = sumByCol(allRows, i - 1);
    console.log(`  col${i}: ${s}`);
  }
}

main().catch((e) => {
  console.error("FATAL:", e);
  process.exit(1);
});
