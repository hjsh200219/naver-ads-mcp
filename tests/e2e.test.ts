import { describe, it, expect, vi, beforeAll, afterAll } from "vitest";
import { mkdtempSync, rmSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { gzipSync } from "node:zlib";
import ExcelJS from "exceljs";
import { createServer } from "../src/mcp/server.js";
import type { INaverAdsClient } from "../src/api/types.js";

// ---------------------------------------------------------------------------
// TSV fixtures by reportTp
// ---------------------------------------------------------------------------

// stat-report v2 responses are header-less raw TSV. Column order per reportTp
// is defined by COLUMN_MAPS in src/api/stat-reports.ts (verified via /stats
// cross-check). Fixtures here mirror that schema.

// AD: statDt | customerId | nccCampaignId | nccAdgroupId | nccKeywordId
//   | nccAdId | businessChannelId | _u8 | pcMblTp | impCnt | clkCnt
//   | salesAmt | avgRnkWeighted | _u14
// avgRnkWeighted = avgRnk × impCnt → 3.5*1000=3500, 1.8*2000=3600
const AD_FIXTURE =
  [
    "20260206\t111\tcmp-1\tag-1\tkw-1\tad-1\tbsn-1\t0\tP\t1000\t10\t11000\t3500\t0",
    "20260206\t111\tcmp-1\tag-1\tkw-1\tad-1\tbsn-1\t0\tM\t2000\t30\t33000\t3600\t0",
  ].join("\n") + "\n";

// AD_CONVERSION: statDt | customerId | nccCampaignId | nccAdgroupId
//   | nccKeywordId | nccAdId | businessChannelId | _u8 | pcMblTp | _u10
//   | convTpName | ccnt | convAmt
// `lead` → 신청완료 per CONV_TP_TO_COL
const AD_CONVERSION_FIXTURE =
  "20260206\t111\tcmp-1\tag-1\tkw-1\tad-1\tbsn-1\t0\tP\t0\tlead\t1\t50000\n";

// AD_DETAIL: 16 cols (adds 2 _unused sub-detail codes at col8/9)
const AD_DETAIL_FIXTURE =
  "20260206\t111\tcmp-1\tag-1\tkw-1\tad-1\tbsn-1\t13\t02\t0\tP\t100\t5\t1500\t110\t0\n";

const TSV_BY_REPORT_TP: Record<string, string> = {
  AD: AD_FIXTURE,
  AD_CONVERSION: AD_CONVERSION_FIXTURE,
  AD_DETAIL: AD_DETAIL_FIXTURE,
  AD_CONVERSION_DETAIL: "",
  EXPKEYWORD: "",
  SHOPPINGKEYWORD_DETAIL: "",
  SHOPPINGKEYWORD_CONVERSION_DETAIL: "",
  SHOPPINGBRANDPRODUCT: "",
  SHOPPINGBRANDPRODUCT_CONVERSION: "",
  BRND_CONTRACT: "",
};

// ---------------------------------------------------------------------------
// Mock fetch: parses reportTp from URL scheme "https://example.com/r/{reportTp}"
// ---------------------------------------------------------------------------

function makeMockFetch(): typeof globalThis.fetch {
  return vi.fn(async (input: string | URL | Request) => {
    const url = typeof input === "string" ? input : input.toString();
    // URL pattern: https://example.com/r/{REPORT_TP}
    const match = url.match(/https:\/\/example\.com\/r\/(.+)$/);
    if (!match) {
      throw new Error(`Unexpected fetch URL: ${url}`);
    }
    const reportTp = match[1]!;
    const tsv = TSV_BY_REPORT_TP[reportTp];
    if (tsv === undefined) {
      throw new Error(`No TSV fixture for reportTp: ${reportTp}`);
    }
    const buf = gzipSync(Buffer.from(tsv, "utf-8"));
    // Return a minimal Response-like object matching what requestStatReport expects
    return {
      arrayBuffer: async (): Promise<ArrayBuffer> => {
        const copy = Buffer.alloc(buf.length);
        buf.copy(copy);
        return copy.buffer.slice(
          copy.byteOffset,
          copy.byteOffset + copy.byteLength,
        ) as ArrayBuffer;
      },
    } as unknown as Response;
  }) as unknown as typeof globalThis.fetch;
}

// ---------------------------------------------------------------------------
// Mock client
// ---------------------------------------------------------------------------

// Map from numeric reportJobId → reportTp string, shared within one client instance.
// Each POST to /stat-reports gets a unique jobId so the subsequent GET poll
// can return the correct downloadUrl without a race on a single "lastReportTp".
const REPORT_TP_LIST = [
  "AD",
  "AD_DETAIL",
  "AD_CONVERSION",
  "AD_CONVERSION_DETAIL",
  "EXPKEYWORD",
  "SHOPPINGKEYWORD_DETAIL",
  "SHOPPINGKEYWORD_CONVERSION_DETAIL",
  "SHOPPINGBRANDPRODUCT",
  "SHOPPINGBRANDPRODUCT_CONVERSION",
  "BRND_CONTRACT",
];

function makeMockClient(): INaverAdsClient {
  // jobId → reportTp: populated when POST /stat-reports is called
  const jobReportTp = new Map<number, string>();
  let nextJobId = 1;

  return {
    get: vi.fn(async (p: string) => {
      if (p === "/ncc/campaigns") {
        return [
          {
            nccCampaignId: "cmp-1",
            customerId: 1,
            name: "헬로맥스AI에이전트#파워링크#PC",
            campaignTp: "WEB_SITE",
            status: "ELIGIBLE",
          },
        ];
      }
      if (p === "/ncc/adgroups") {
        return [
          {
            nccAdgroupId: "ag-1",
            nccCampaignId: "cmp-1",
            name: "파워링크#adgrp#0",
          },
        ];
      }
      if (p === "/ncc/keywords") {
        return [
          {
            nccKeywordId: "kw-1",
            nccAdgroupId: "ag-1",
            keyword: "헬로맥스",
          },
        ];
      }
      if (p === "/ncc/product-groups") return [];
      if (p === "/billing/bizmoney") return { ok: true };
      if (p.startsWith("/stat-reports/")) {
        // pollUntilBuilt: GET /stat-reports/{jobId}
        const jobId = Number(p.replace("/stat-reports/", ""));
        const reportTp = jobReportTp.get(jobId) ?? "AD";
        return {
          reportJobId: jobId,
          status: "BUILT",
          downloadUrl: `https://example.com/r/${reportTp}`,
        };
      }
      throw new Error(`Unexpected GET: ${p}`);
    }),
    post: vi.fn(async (p: string, body: unknown) => {
      if (p === "/stat-reports") {
        const b = body as { reportTp: string; statDt: string };
        const jobId = nextJobId++;
        jobReportTp.set(jobId, b.reportTp);
        return {
          reportJobId: jobId,
          status: "BUILT",
          downloadUrl: `https://example.com/r/${b.reportTp}`,
        };
      }
      throw new Error(`Unexpected POST: ${p}`);
    }),
    downloadBinary: vi.fn(async (url: string) => {
      const match = url.match(/https:\/\/example\.com\/r\/(.+)$/);
      if (!match) throw new Error(`Unexpected downloadBinary URL: ${url}`);
      const tsv = TSV_BY_REPORT_TP[match[1]!];
      if (tsv === undefined) throw new Error(`No TSV for ${match[1]}`);
      return gzipSync(Buffer.from(tsv, "utf-8"));
    }),
  };
}

// ---------------------------------------------------------------------------
// Test suite
// ---------------------------------------------------------------------------

let tmpDir: string;
let outputPath: string;

beforeAll(() => {
  tmpDir = mkdtempSync(path.join(tmpdir(), "e2e-test-"));
  outputPath = path.join(tmpDir, "report.xlsx");
});

afterAll(() => {
  rmSync(tmpDir, { recursive: true, force: true });
});

describe("E2E: generate_report smoke test", () => {
  it("server boots with mocked deps without throwing", () => {
    const mockClient = makeMockClient();
    const mockFetch = makeMockFetch();
    const { server, tools } = createServer({
      client: mockClient,
      fetch: mockFetch,
    });
    expect(server).toBeDefined();
    expect(tools).toBeDefined();
    expect(typeof tools.generate_report).toBe("function");
  });

  it("generate_report produces a 10-sheet xlsx file", async () => {
    const mockClient = makeMockClient();
    const mockFetch = makeMockFetch();
    const { tools } = createServer({ client: mockClient, fetch: mockFetch });

    const result = (await tools.generate_report({
      startDate: "20260206",
      endDate: "20260206",
      outputPath,
    })) as {
      path: string;
      sheetNames: string[];
      visibility: Record<string, string>;
    };

    // File exists
    expect(existsSync(outputPath)).toBe(true);

    // Exactly 10 sheets
    expect(result.sheetNames).toHaveLength(10);

    // Sheet names match expected order
    const EXPECTED_SHEETS = [
      "SUMMARY",
      "매체별 성과",
      "키워드 성과",
      "상품 성과",
      "검색어 성과",
      "브랜드검색 성과",
      "소재RAW",
      "검색어RAW",
      "일별RAW",
      "키워드RAW",
    ];
    expect(result.sheetNames).toEqual(EXPECTED_SHEETS);
  });

  it("sheet visibility is correct for 파워링크-only data", async () => {
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.readFile(outputPath);

    const visibility: Record<string, string> = {};
    wb.eachSheet((ws, id) => {
      visibility[ws.name] = ws.state;
    });

    // Always visible
    expect(visibility["SUMMARY"]).toBe("visible");
    expect(visibility["매체별 성과"]).toBe("visible");
    expect(visibility["키워드 성과"]).toBe("visible"); // rawKeyword has data
    expect(visibility["일별RAW"]).toBe("visible");
    expect(visibility["키워드RAW"]).toBe("visible");

    // Hidden — no shopping/search-term/material data
    expect(visibility["상품 성과"]).toBe("hidden");
    expect(visibility["검색어 성과"]).toBe("hidden");
    expect(visibility["브랜드검색 성과"]).toBe("hidden");
    expect(visibility["소재RAW"]).toBe("hidden");
    expect(visibility["검색어RAW"]).toBe("hidden");
  });

  it("일별RAW has correct header, 2 data rows, and expected cell values", async () => {
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.readFile(outputPath);

    const ws = wb.getWorksheet("일별RAW");
    expect(ws).toBeDefined();

    // Header row
    const headerRow = ws!.getRow(1).values as (string | undefined)[];
    // ExcelJS row.values is 1-indexed (index 0 is undefined)
    const headers = headerRow.slice(1);

    const { HEADERS_DAILY_RAW } = await import("../src/excel/headers.js");
    expect(headers).toEqual(HEADERS_DAILY_RAW);

    // 2 data rows (PC + MO)
    const dataRows: ExcelJS.Row[] = [];
    ws!.eachRow((row, rowNum) => {
      if (rowNum > 1) dataRows.push(row);
    });
    expect(dataRows).toHaveLength(2);

    // Find PC and MO rows by device column (index 8 → "디바이스.")
    const deviceIdx = HEADERS_DAILY_RAW.indexOf("디바이스.") + 1; // 1-based
    const clkIdx = HEADERS_DAILY_RAW.indexOf("클릭수.") + 1;

    const pcRow = dataRows.find((r) => r.getCell(deviceIdx).value === "PC");
    const moRow = dataRows.find((r) => r.getCell(deviceIdx).value === "MO");

    expect(pcRow).toBeDefined();
    expect(moRow).toBeDefined();

    expect(pcRow!.getCell(clkIdx).value).toBe(10);
    expect(moRow!.getCell(clkIdx).value).toBe(30);
  });

  it("conversion column 신청완료 is 1 for PC row (convTpCd=3)", async () => {
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.readFile(outputPath);

    const ws = wb.getWorksheet("일별RAW");
    const { HEADERS_DAILY_RAW } = await import("../src/excel/headers.js");

    const deviceIdx = HEADERS_DAILY_RAW.indexOf("디바이스.") + 1;
    const convIdx = HEADERS_DAILY_RAW.indexOf("신청완료.") + 1;

    let pcConv: number | null = null;
    ws!.eachRow((row, rowNum) => {
      if (rowNum > 1 && row.getCell(deviceIdx).value === "PC") {
        pcConv = row.getCell(convIdx).value as number;
      }
    });

    expect(pcConv).toBe(1);
  });

  it("광고비 (VAT-) for PC row equals salesAmt/1.1 = 10000", async () => {
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.readFile(outputPath);

    const ws = wb.getWorksheet("일별RAW");
    const { HEADERS_DAILY_RAW } = await import("../src/excel/headers.js");

    const deviceIdx = HEADERS_DAILY_RAW.indexOf("디바이스.") + 1;
    const vatIdx = HEADERS_DAILY_RAW.indexOf("광고비 (VAT-).") + 1;

    let pcVat: number | null = null;
    ws!.eachRow((row, rowNum) => {
      if (rowNum > 1 && row.getCell(deviceIdx).value === "PC") {
        pcVat = row.getCell(vatIdx).value as number;
      }
    });

    // salesAmt=11000, vatIncluded=true → 11000/1.1 = 10000
    expect(pcVat).toBe(10000);
  });
});

// ---------------------------------------------------------------------------
// Regression: generate_report must not swallow non-StatReportFailedError
// errors from requestStatReport. Previously a catch-all returned [] and
// hid real failures (network, 5xx, auth) for 8 weeks.
// ---------------------------------------------------------------------------

describe("generate_report error propagation", () => {
  it("propagates network errors from requestStatReport (no silent empty)", async () => {
    // Mock client whose POST /stat-reports rejects with a non-StatReportFailedError.
    const flakyClient: INaverAdsClient = {
      get: vi.fn(async (p: string) => {
        if (p === "/ncc/campaigns") return [];
        if (p === "/ncc/adgroups") return [];
        if (p === "/ncc/keywords") return [];
        if (p === "/ncc/product-groups") return [];
        throw new Error(`Unexpected GET: ${p}`);
      }),
      post: vi.fn(async () => {
        throw new Error("ECONNREFUSED simulated network failure");
      }),
      downloadBinary: vi.fn(async () => Buffer.from("")),
    };

    const { tools } = createServer({ client: flakyClient });

    await expect(
      tools.generate_report({
        startDate: "20260206",
        endDate: "20260206",
        outputPath: path.join(tmpDir, "should-not-exist.xlsx"),
      }),
    ).rejects.toThrow(/ECONNREFUSED/);
  });
});
