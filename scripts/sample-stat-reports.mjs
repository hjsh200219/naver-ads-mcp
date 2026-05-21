#!/usr/bin/env node
// Live-download one stat-report per reportTp for inspection.
// Usage: node scripts/sample-stat-reports.mjs [statDt YYYYMMDD] [account]
//
// Writes one .tsv per reportTp into scripts/samples/{statDt}/. Skips quietly on
// NONE/FAILED status (which means "no data" — happens for many accounts).

import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

import { NaverAdsClient } from "../dist/api/client.js";
import {
  REPORT_TYPES,
  requestStatReport,
  parseTsv,
  StatReportFailedError,
} from "../dist/api/stat-reports.js";
import { freezeCredential } from "../dist/config/credentials.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");
const ACCOUNTS_PATH = resolve(ROOT, "accounts.json");

function pickStatDt() {
  const arg = process.argv[2];
  if (arg && /^\d{8}$/.test(arg)) return arg;
  // default = day before yesterday (D-2) to avoid same-day buffering misses
  const d = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}${m}${day}`;
}

function pickAccount() {
  const raw = JSON.parse(readFileSync(ACCOUNTS_PATH, "utf-8"));
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

// Wrap requestStatReport to also return the raw downloaded text + bytes for
// inspection. We re-implement the flow to capture the raw TSV before parsing.
async function downloadRawTsv(client, reportTp, statDt) {
  const post = await client.post("/stat-reports", { reportTp, statDt });
  const jobId = post.reportJobId;
  let downloadUrl;
  let elapsed = 0;
  let delay = 1_000;
  const startedAt = Date.now();
  while (true) {
    elapsed = Date.now() - startedAt;
    if (elapsed > 600_000) throw new Error(`${reportTp} polling timeout`);
    const job = await client.get(`/stat-reports/${jobId}`);
    if (job.status === "BUILT") {
      if (!job.downloadUrl) throw new Error(`${reportTp} BUILT but no url`);
      downloadUrl = job.downloadUrl;
      break;
    }
    if (job.status === "FAILED" || job.status === "NONE") {
      throw new StatReportFailedError(jobId, job.status);
    }
    await new Promise((r) => setTimeout(r, delay));
    delay = Math.min(delay * 2, 30_000);
  }
  const buf = await client.downloadBinary(downloadUrl);
  const isGzip = buf.length >= 2 && buf[0] === 0x1f && buf[1] === 0x8b;
  let text;
  if (isGzip) {
    const { gunzipSync } = await import("node:zlib");
    text = gunzipSync(buf).toString("utf-8");
  } else {
    text = buf.toString("utf-8");
  }
  return { jobId, isGzip, byteLen: buf.length, text };
}

async function main() {
  const statDt = pickStatDt();
  const { name, cred } = pickAccount();
  const outDir = resolve(ROOT, "scripts/samples", statDt);
  mkdirSync(outDir, { recursive: true });

  const client = new NaverAdsClient({
    baseUrl: "https://api.searchad.naver.com",
    credentials: cred,
  });

  console.error(`# statDt=${statDt} account=${name} → ${outDir}`);

  const summary = [];
  for (const reportTp of REPORT_TYPES) {
    process.stderr.write(`- ${reportTp}: `);
    try {
      const { jobId, isGzip, byteLen, text } = await downloadRawTsv(
        client,
        reportTp,
        statDt,
      );
      const tsvPath = resolve(outDir, `${reportTp}.tsv`);
      writeFileSync(tsvPath, text, "utf-8");

      const lines = text.split("\n").filter((l) => l.trim() !== "");
      const firstCols = lines[0]?.split("\t").length ?? 0;
      const sampleRows = lines.slice(0, 3);
      summary.push({
        reportTp,
        jobId,
        bytes: byteLen,
        gzip: isGzip,
        lineCount: lines.length,
        colCount: firstCols,
        sample: sampleRows,
      });
      console.error(
        `OK ${lines.length} lines, ${firstCols} cols, ${byteLen}B${isGzip ? " gz" : ""}`,
      );
    } catch (err) {
      const status =
        err instanceof StatReportFailedError ? err.message : (err?.message ?? String(err));
      summary.push({ reportTp, error: status });
      console.error(`SKIP ${status}`);
    }
  }

  const summaryPath = resolve(outDir, "_summary.json");
  writeFileSync(summaryPath, JSON.stringify(summary, null, 2), "utf-8");
  console.error(`\n→ summary: ${summaryPath}`);
}

main().catch((e) => {
  console.error("FATAL:", e);
  process.exit(1);
});
