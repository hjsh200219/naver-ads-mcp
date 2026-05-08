#!/usr/bin/env node
// E2E comparison: generated report vs. reference template
//
// 1) Run generate_report with the existing E2E mock client/fetch
// 2) Compare structure, headers, number formats, and styles with
//    docs/references/1778140340186_(FORM) helloMAX Report_신청완료.xlsx
//
// Data values are NOT compared — reference is real data, generated is mock.
// Only structural / format / style fidelity is asserted.

import ExcelJS from "exceljs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { gzipSync } from "node:zlib";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const REF_PATH = path.join(
  ROOT,
  "docs",
  "references",
  "1778140340186_(FORM) helloMAX Report_신청완료.xlsx",
);

// ---------------------------------------------------------------------------
// Generate output xlsx by exercising the MCP `generate_report` tool with the
// same mocks used in tests/e2e.test.ts (so we're testing the real writer path)
// ---------------------------------------------------------------------------

const TSV_BY_REPORT_TP = {
  AD:
    [
      "statDt\tnccCampaignId\tnccAdgroupId\tpcMblTp\timpCnt\tclkCnt\tsalesAmt\tavgRnk",
      "20260206\tcmp-1\tag-1\tPC\t1000\t10\t11000\t3.5",
      "20260206\tcmp-1\tag-1\tMO\t2000\t30\t33000\t1.8",
    ].join("\n") + "\n",
  AD_CONVERSION:
    [
      "statDt\tnccCampaignId\tnccAdgroupId\tpcMblTp\tconvTpCd\tccnt\tconvAmt",
      "20260206\tcmp-1\tag-1\tPC\t3\t1\t50000",
    ].join("\n") + "\n",
  AD_DETAIL:
    [
      "statDt\tnccCampaignId\tnccAdgroupId\tpcMblTp\tnccKeywordId\tkeyword\timpCnt\tclkCnt\tsalesAmt\tavgRnk",
      "20260206\tcmp-1\tag-1\tPC\tkw-1\t헬로맥스\t100\t5\t1500\t1.1",
    ].join("\n") + "\n",
  AD_CONVERSION_DETAIL:
    "statDt\tnccCampaignId\tnccAdgroupId\tpcMblTp\tnccKeywordId\tkeyword\tconvTpCd\tccnt\tconvAmt\n",
  EXPKEYWORD: "statDt\timpCnt\n",
  SHOPPINGKEYWORD_DETAIL: "header\n",
  SHOPPINGKEYWORD_CONVERSION_DETAIL: "header\n",
  SHOPPINGBRANDPRODUCT: "header\n",
  SHOPPINGBRANDPRODUCT_CONVERSION: "header\n",
  BRND_CONTRACT: "header\n",
};

function makeMockFetch() {
  return async (input) => {
    const url = typeof input === "string" ? input : input.toString();
    const m = url.match(/https:\/\/example\.com\/r\/(.+)$/);
    if (!m) throw new Error(`Unexpected URL: ${url}`);
    const tp = m[1];
    const tsv = TSV_BY_REPORT_TP[tp];
    if (tsv === undefined) throw new Error(`No fixture for ${tp}`);
    const buf = gzipSync(Buffer.from(tsv, "utf-8"));
    return {
      arrayBuffer: async () => {
        const copy = Buffer.alloc(buf.length);
        buf.copy(copy);
        return copy.buffer.slice(copy.byteOffset, copy.byteOffset + copy.byteLength);
      },
    };
  };
}

function makeMockClient() {
  const jobMap = new Map();
  let nextJob = 1;
  return {
    get: async (p) => {
      if (p === "/ncc/campaigns")
        return [
          {
            nccCampaignId: "cmp-1",
            customerId: 1,
            name: "헬로맥스AI에이전트#파워링크#PC",
            campaignTp: "WEB_SITE",
            status: "ELIGIBLE",
          },
        ];
      if (p === "/ncc/adgroups")
        return [
          { nccAdgroupId: "ag-1", nccCampaignId: "cmp-1", name: "파워링크#adgrp#0" },
        ];
      if (p === "/ncc/keywords")
        return [{ nccKeywordId: "kw-1", nccAdgroupId: "ag-1", keyword: "헬로맥스" }];
      if (p === "/ncc/product-groups") return [];
      if (p === "/billing/bizmoney") return { ok: true };
      if (p.startsWith("/stat-reports/")) {
        const id = Number(p.replace("/stat-reports/", ""));
        const tp = jobMap.get(id) ?? "AD";
        return { reportJobId: id, status: "BUILT", downloadUrl: `https://example.com/r/${tp}` };
      }
      throw new Error(`Unexpected GET ${p}`);
    },
    post: async (p, body) => {
      if (p === "/stat-reports") {
        const id = nextJob++;
        jobMap.set(id, body.reportTp);
        return {
          reportJobId: id,
          status: "BUILT",
          downloadUrl: `https://example.com/r/${body.reportTp}`,
        };
      }
      throw new Error(`Unexpected POST ${p}`);
    },
  };
}

// ---------------------------------------------------------------------------
// Comparison logic
// ---------------------------------------------------------------------------

function summarizeSheet(ws) {
  const merged = ws.model?.merges ?? [];
  const headerRow = ws.getRow(1);
  const headers = [];
  headerRow.eachCell({ includeEmpty: false }, (c) => headers.push(String(c.value ?? "")));
  // Detect title/heading rows by searching first 6 rows for a "■ ..." pattern
  let titleRowIdx = null;
  let titleText = null;
  for (let r = 1; r <= Math.min(ws.rowCount, 6); r++) {
    const row = ws.getRow(r);
    let foundTitle = null;
    row.eachCell({ includeEmpty: false }, (c) => {
      const v = String(c.value ?? "");
      if (v.startsWith("■") && foundTitle === null) foundTitle = v;
    });
    if (foundTitle && titleRowIdx === null) {
      titleRowIdx = r;
      titleText = foundTitle;
    }
  }
  // First data row sample number formats
  const dataRowIdx = ws.rowCount >= 2 ? 2 : null;
  const numFmts = [];
  if (dataRowIdx) {
    const row = ws.getRow(dataRowIdx);
    row.eachCell({ includeEmpty: false }, (c) => {
      numFmts.push({ addr: c.address, type: c.type, numFmt: c.numFmt ?? null });
    });
  }
  // Style sample from first non-empty header cell
  let headerStyle = null;
  headerRow.eachCell({ includeEmpty: false }, (c) => {
    if (headerStyle === null) {
      headerStyle = {
        font: c.font ?? null,
        fill: c.fill ?? null,
        border: c.border ? "yes" : null,
        alignment: c.alignment ?? null,
      };
    }
  });
  // Column widths
  const widths = [];
  for (let c = 1; c <= ws.columnCount; c++) {
    widths.push(ws.getColumn(c).width ?? null);
  }
  return {
    name: ws.name,
    state: ws.state,
    rowCount: ws.rowCount,
    columnCount: ws.columnCount,
    mergedCount: merged.length,
    headers,
    titleRowIdx,
    titleText,
    numFmts,
    headerStyle,
    widths,
  };
}

function diffArrays(a, b) {
  const max = Math.max(a.length, b.length);
  const out = [];
  for (let i = 0; i < max; i++) {
    const va = a[i];
    const vb = b[i];
    if (va !== vb) out.push({ idx: i, ref: va, gen: vb });
  }
  return out;
}

function fmtSummary(s) {
  return [
    `  state=${s.state} rows=${s.rowCount} cols=${s.columnCount} merged=${s.mergedCount}`,
    `  title row=${s.titleRowIdx} text=${JSON.stringify(s.titleText)}`,
    `  headers (${s.headers.length})=${JSON.stringify(s.headers.slice(0, 12))}${s.headers.length > 12 ? "…" : ""}`,
    `  headerStyle.fill=${JSON.stringify(s.headerStyle?.fill)}`,
    `  headerStyle.font=${JSON.stringify(s.headerStyle?.font)}`,
    `  headerStyle.border=${s.headerStyle?.border}`,
    `  numFmts (first 8)=${JSON.stringify(s.numFmts.slice(0, 8))}`,
    `  widths (first 12)=${JSON.stringify(s.widths.slice(0, 12))}`,
  ].join("\n");
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

const tmp = mkdtempSync(path.join(tmpdir(), "compare-"));
const outPath = path.join(tmp, "generated.xlsx");

try {
  const { createServer } = await import(path.join(ROOT, "src/mcp/server.ts"));
  const { tools } = createServer({ client: makeMockClient(), fetch: makeMockFetch() });
  await tools.generate_report({ startDate: "20260206", endDate: "20260206", outputPath: outPath });

  const ref = new ExcelJS.Workbook();
  await ref.xlsx.readFile(REF_PATH);
  const gen = new ExcelJS.Workbook();
  await gen.xlsx.readFile(outPath);

  const refSheets = ref.worksheets.map(summarizeSheet);
  const genSheets = gen.worksheets.map(summarizeSheet);

  const findings = [];
  const recordIssue = (sev, area, msg) => findings.push({ sev, area, msg });

  // 1) Sheet count
  if (refSheets.length !== genSheets.length) {
    recordIssue("FAIL", "workbook", `sheet count: ref=${refSheets.length} gen=${genSheets.length}`);
  } else {
    recordIssue("OK", "workbook", `sheet count match: ${refSheets.length}`);
  }

  // 2) Sheet name + order
  const refNames = refSheets.map((s) => s.name);
  const genNames = genSheets.map((s) => s.name);
  const orderDiffs = diffArrays(refNames, genNames);
  if (orderDiffs.length === 0) {
    recordIssue("OK", "sheet-order", `names+order match`);
  } else {
    recordIssue("FAIL", "sheet-order", `mismatches: ${JSON.stringify(orderDiffs)}`);
  }

  // 3) Per-sheet detail comparison (only for shared names)
  const shared = refNames.filter((n) => genNames.includes(n));
  for (const name of shared) {
    const r = refSheets.find((s) => s.name === name);
    const g = genSheets.find((s) => s.name === name);
    if (!r || !g) continue;

    // Visibility
    if (r.state !== g.state) {
      recordIssue("WARN", `${name}/visibility`, `ref=${r.state} gen=${g.state}`);
    } else {
      recordIssue("OK", `${name}/visibility`, r.state);
    }

    // Title row
    if (r.titleText !== g.titleText) {
      recordIssue("FAIL", `${name}/title`, `ref=${JSON.stringify(r.titleText)} gen=${JSON.stringify(g.titleText)}`);
    }

    // Headers (compare first 12 to limit noise)
    const refH = r.headers.map((h) => h.replace(/\.$/, "")); // ignore trailing dot for fairness
    const genH = g.headers.map((h) => h.replace(/\.$/, ""));
    const hdrDiffs = diffArrays(refH, genH);
    if (hdrDiffs.length > 0) {
      recordIssue(
        "FAIL",
        `${name}/headers`,
        `${hdrDiffs.length} mismatch(es); first 5: ${JSON.stringify(hdrDiffs.slice(0, 5))}`,
      );
    } else {
      recordIssue("OK", `${name}/headers`, `${refH.length} headers match`);
    }

    // Header trailing-dot convention (RAW sheets only)
    if (name.endsWith("RAW")) {
      const refTrailingDot = r.headers.every((h) => h.endsWith("."));
      const genTrailingDot = g.headers.every((h) => h.endsWith("."));
      if (refTrailingDot !== genTrailingDot) {
        recordIssue(
          "WARN",
          `${name}/header-suffix`,
          `ref trailingDot=${refTrailingDot} gen=${genTrailingDot} — pivot table convention`,
        );
      }
    }

    // Number formats — first 8 columns
    const refFmts = r.numFmts.map((c) => c.numFmt);
    const genFmts = g.numFmts.map((c) => c.numFmt);
    const fmtDiffs = diffArrays(refFmts.slice(0, 8), genFmts.slice(0, 8));
    if (fmtDiffs.length > 0) {
      recordIssue(
        "WARN",
        `${name}/numFmt`,
        `first 8 cols differ: ${JSON.stringify(fmtDiffs)}`,
      );
    }

    // Header style: fill + font.bold + border
    const refFill = r.headerStyle?.fill;
    const genFill = g.headerStyle?.fill;
    if (JSON.stringify(refFill) !== JSON.stringify(genFill)) {
      recordIssue(
        "WARN",
        `${name}/header-fill`,
        `ref=${JSON.stringify(refFill)} gen=${JSON.stringify(genFill)}`,
      );
    }
    const refBorder = r.headerStyle?.border;
    const genBorder = g.headerStyle?.border;
    if (refBorder !== genBorder) {
      recordIssue(
        "WARN",
        `${name}/header-border`,
        `ref=${refBorder} gen=${genBorder}`,
      );
    }

    // Column widths sample (first 5)
    const widthDiffs = diffArrays(r.widths.slice(0, 5), g.widths.slice(0, 5));
    if (widthDiffs.length > 0) {
      recordIssue(
        "WARN",
        `${name}/col-widths`,
        `first 5 differ: ${JSON.stringify(widthDiffs)}`,
      );
    }
  }

  // ---------------------------------------------------------------------------
  // Print report
  // ---------------------------------------------------------------------------
  console.log("\n========== REFERENCE SHEET SUMMARY ==========");
  for (const s of refSheets) {
    console.log(`\n[REF] ${s.name}`);
    console.log(fmtSummary(s));
  }
  console.log("\n========== GENERATED SHEET SUMMARY ==========");
  for (const s of genSheets) {
    console.log(`\n[GEN] ${s.name}`);
    console.log(fmtSummary(s));
  }

  console.log("\n========== FINDINGS ==========");
  const failCount = findings.filter((f) => f.sev === "FAIL").length;
  const warnCount = findings.filter((f) => f.sev === "WARN").length;
  const okCount = findings.filter((f) => f.sev === "OK").length;
  for (const f of findings) {
    console.log(`[${f.sev.padEnd(4)}] ${f.area}: ${f.msg}`);
  }
  console.log("\n========== SUMMARY ==========");
  console.log(`OK:   ${okCount}`);
  console.log(`WARN: ${warnCount}`);
  console.log(`FAIL: ${failCount}`);

  process.exitCode = failCount > 0 ? 1 : 0;
} finally {
  rmSync(tmp, { recursive: true, force: true });
}
