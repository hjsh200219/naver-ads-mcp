// E2E parity test: generated report vs. docs/references reference template.
//
// Asserts that the generated workbook matches the reference template's
// structure, headers, number formats, fills, fonts, borders, and column widths.
//
// Data values are NOT compared (mock fixtures vs. real customer data); only
// structure and styling.

import { describe, it, expect, beforeAll } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { gzipSync } from "node:zlib";
import ExcelJS from "exceljs";
import { createServer } from "../src/mcp/server.js";
import type { INaverAdsClient } from "../src/api/types.js";

// ---------------------------------------------------------------------------
// Mock fixtures
// ---------------------------------------------------------------------------

const TSV_BY_REPORT_TP: Record<string, string> = {
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

function makeMockFetch(): typeof globalThis.fetch {
  return (async (input: string | URL | Request) => {
    const url = typeof input === "string" ? input : input.toString();
    const m = url.match(/https:\/\/example\.com\/r\/(.+)$/);
    if (!m) throw new Error(`Unexpected URL: ${url}`);
    const tp = m[1]!;
    const tsv = TSV_BY_REPORT_TP[tp];
    if (tsv === undefined) throw new Error(`No fixture for ${tp}`);
    const buf = gzipSync(Buffer.from(tsv, "utf-8"));
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

function makeMockClient(): INaverAdsClient {
  const jobMap = new Map<number, string>();
  let nextJob = 1;
  return {
    get: async (p: string) => {
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
          {
            nccAdgroupId: "ag-1",
            nccCampaignId: "cmp-1",
            name: "파워링크#adgrp#0",
          },
        ];
      if (p === "/ncc/keywords")
        return [
          { nccKeywordId: "kw-1", nccAdgroupId: "ag-1", keyword: "헬로맥스" },
        ];
      if (p === "/ncc/product-groups") return [];
      if (p === "/billing/bizmoney") return { ok: true };
      if (p.startsWith("/stat-reports/")) {
        const id = Number(p.replace("/stat-reports/", ""));
        const tp = jobMap.get(id) ?? "AD";
        return {
          reportJobId: id,
          status: "BUILT",
          downloadUrl: `https://example.com/r/${tp}`,
        };
      }
      throw new Error(`Unexpected GET ${p}`);
    },
    post: async (p: string, body: unknown) => {
      if (p === "/stat-reports") {
        const b = body as { reportTp: string };
        const id = nextJob++;
        jobMap.set(id, b.reportTp);
        return {
          reportJobId: id,
          status: "BUILT",
          downloadUrl: `https://example.com/r/${b.reportTp}`,
        };
      }
      throw new Error(`Unexpected POST ${p}`);
    },
  };
}

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

const REF_PATH = path.resolve(
  __dirname,
  "..",
  "docs",
  "references",
  "1778140340186_(FORM) helloMAX Report_신청완료.xlsx",
);

let tmpDir: string;
let outputPath: string;
let refWb: ExcelJS.Workbook;
let genWb: ExcelJS.Workbook;

beforeAll(async () => {
  tmpDir = mkdtempSync(path.join(tmpdir(), "ref-parity-"));
  outputPath = path.join(tmpDir, "generated.xlsx");

  const { tools } = createServer({
    client: makeMockClient(),
    fetch: makeMockFetch(),
  });
  await tools.generate_report({
    startDate: "20260206",
    endDate: "20260206",
    outputPath,
  });

  refWb = new ExcelJS.Workbook();
  await refWb.xlsx.readFile(REF_PATH);

  genWb = new ExcelJS.Workbook();
  await genWb.xlsx.readFile(outputPath);

  return () => rmSync(tmpDir, { recursive: true, force: true });
});

// ---------------------------------------------------------------------------
// Workbook structure
// ---------------------------------------------------------------------------

describe("Reference parity: workbook structure", () => {
  it("sheet count matches reference (10)", () => {
    expect(genWb.worksheets.length).toBe(refWb.worksheets.length);
    expect(genWb.worksheets.length).toBe(10);
  });

  it("sheet names + order match reference", () => {
    expect(genWb.worksheets.map((w) => w.name)).toEqual(
      refWb.worksheets.map((w) => w.name),
    );
  });

  it("visibility matches reference for all 10 sheets", () => {
    for (const refWs of refWb.worksheets) {
      const genWs = genWb.getWorksheet(refWs.name)!;
      expect(genWs.state).toBe(refWs.state);
    }
  });
});

// ---------------------------------------------------------------------------
// RAW sheets
// ---------------------------------------------------------------------------

describe("Reference parity: RAW sheets", () => {
  const RAW_SHEETS = ["일별RAW", "키워드RAW", "검색어RAW", "소재RAW"];

  for (const name of RAW_SHEETS) {
    it(`${name} headers exactly match reference (with trailing dot)`, () => {
      const refWs = refWb.getWorksheet(name)!;
      const genWs = genWb.getWorksheet(name)!;
      const refH = (refWs.getRow(1).values as (string | undefined)[]).slice(1);
      const genH = (genWs.getRow(1).values as (string | undefined)[]).slice(1);
      expect(genH).toEqual(refH);
      expect(genH.every((h) => String(h ?? "").endsWith("."))).toBe(true);
    });
  }

  it("일별RAW: 날짜 column is Date type with mm-dd-yy", () => {
    const ref = refWb.getWorksheet("일별RAW")!;
    const gen = genWb.getWorksheet("일별RAW")!;
    expect(ref.getRow(2).getCell(3).numFmt).toBe("mm-dd-yy");
    expect(gen.getRow(2).getCell(3).numFmt).toBe("mm-dd-yy");
    expect(gen.getRow(2).getCell(3).value).toBeInstanceOf(Date);
  });

  it("일별RAW: numeric columns formatted as #,##0", () => {
    const ref = refWb.getWorksheet("일별RAW")!;
    const gen = genWb.getWorksheet("일별RAW")!;
    expect(ref.getRow(2).getCell(9).numFmt).toBe("#,##0");
    expect(gen.getRow(2).getCell(9).numFmt).toBe("#,##0");
  });

  it("일별RAW: 평균노출순위 column formatted as #,##0.00", () => {
    const ref = refWb.getWorksheet("일별RAW")!;
    const gen = genWb.getWorksheet("일별RAW")!;
    expect(ref.getRow(2).getCell(17).numFmt).toBe("#,##0.00");
    expect(gen.getRow(2).getCell(17).numFmt).toBe("#,##0.00");
  });

  it("소재RAW: header has 맑은 고딕 font + border", () => {
    const gen = genWb.getWorksheet("소재RAW")!;
    expect(gen.getRow(1).getCell(1).font?.name).toBe("맑은 고딕");
    expect(gen.getRow(1).getCell(1).border).toBeDefined();
  });

  it("소재RAW: conversion columns get yellow fill on header", () => {
    const gen = genWb.getWorksheet("소재RAW")!;
    // 구매완료=O(15), 회원가입=P(16), 신청완료=Q(17), 기타전환=R(18)
    for (const col of [15, 16, 17, 18]) {
      const fill = gen.getRow(1).getCell(col).fill as
        | ExcelJS.FillPattern
        | undefined;
      expect((fill?.fgColor as { argb?: string })?.argb).toBe("FFFFFF00");
    }
  });

  it("일별RAW + 키워드RAW: 날짜 column width = 11.125", () => {
    const refDaily = refWb.getWorksheet("일별RAW")!;
    const genDaily = genWb.getWorksheet("일별RAW")!;
    expect(refDaily.getColumn(3).width).toBe(11.125);
    expect(genDaily.getColumn(3).width).toBe(11.125);
  });
});

// ---------------------------------------------------------------------------
// Pivot sheets — title + section subheads
// ---------------------------------------------------------------------------

describe("Reference parity: pivot sheet titles and sections", () => {
  it("SUMMARY: 'helloMAX Ads Report' title at C2:K4 with FFE5ECFF", () => {
    const ref = refWb.getWorksheet("SUMMARY")!;
    const gen = genWb.getWorksheet("SUMMARY")!;
    expect(gen.getRow(2).getCell(3).value).toBe("helloMAX Ads Report");
    const fillR = ref.getRow(2).getCell(3).fill as ExcelJS.FillPattern;
    const fillG = gen.getRow(2).getCell(3).fill as ExcelJS.FillPattern;
    expect((fillG.fgColor as { argb?: string })?.argb).toBe(
      (fillR.fgColor as { argb?: string })?.argb,
    );
    expect(gen.model?.merges).toContain("C2:K4");
  });

  it("SUMMARY: three section subheads (매체별, 캠페인 유형별, 디바이스별)", () => {
    const gen = genWb.getWorksheet("SUMMARY")!;
    const labels: string[] = [];
    gen.eachRow((row) => {
      row.eachCell({ includeEmpty: false }, (c) => {
        if (typeof c.value === "string" && c.value.endsWith("성과"))
          labels.push(c.value);
      });
    });
    expect(labels).toContain("매체별 성과");
    expect(labels).toContain("캠페인 유형별 성과");
    expect(labels).toContain("디바이스별 성과");
  });

  it("매체별 성과: '■ 매체별 상세 성과' at B2", () => {
    const gen = genWb.getWorksheet("매체별 성과")!;
    expect(gen.getRow(2).getCell(2).value).toBe("■ 매체별 상세 성과");
  });

  it("매체별 성과: three sub-section subheads (월별/주차별/일자별 데이터)", () => {
    const gen = genWb.getWorksheet("매체별 성과")!;
    const labels: string[] = [];
    gen.eachRow((row) => {
      row.eachCell({ includeEmpty: false }, (c) => {
        if (typeof c.value === "string" && c.value.endsWith("데이터"))
          labels.push(c.value);
      });
    });
    expect(labels).toEqual(["월별 데이터", "주차별 데이터", "일자별 데이터"]);
  });

  it("키워드 성과: '■ 키워드별 성과' at B2", () => {
    const gen = genWb.getWorksheet("키워드 성과")!;
    expect(gen.getRow(2).getCell(2).value).toBe("■ 키워드별 성과");
  });

  it("상품 성과: '■ 쇼핑검색 상품별 성과' at B2", () => {
    const gen = genWb.getWorksheet("상품 성과")!;
    expect(gen.getRow(2).getCell(2).value).toBe("■ 쇼핑검색 상품별 성과");
  });

  it("검색어 성과: title contains '쇼핑검색 검색어 성과' note", () => {
    const gen = genWb.getWorksheet("검색어 성과")!;
    expect(String(gen.getRow(2).getCell(2).value)).toContain(
      "쇼핑검색 검색어 성과",
    );
  });

  it("브랜드검색 성과: '■ 브랜드검색 소재 영역별 성과' at B2", () => {
    const gen = genWb.getWorksheet("브랜드검색 성과")!;
    expect(String(gen.getRow(2).getCell(2).value)).toContain(
      "브랜드검색 소재 영역별 성과",
    );
  });
});

// ---------------------------------------------------------------------------
// Pivot sheets — number formats and styling
// ---------------------------------------------------------------------------

describe("Reference parity: pivot sheet number formats", () => {
  const ACCT_INT = '_-* #,##0_-;-* #,##0_-;_-* "-"_-;_-@_-';
  const ACCT_DEC = '_-* #,##0.0_-;-* #,##0.0_-;_-* "-"_-;_-@_-';

  it("SUMMARY: (비어 있음) row uses accounting numFmt for integers", () => {
    const gen = genWb.getWorksheet("SUMMARY")!;
    // Find (비어 있음) row in the workbook
    let foundRow: ExcelJS.Row | null = null;
    gen.eachRow((row) => {
      if (row.getCell(2).value === "(비어 있음)" && !foundRow) foundRow = row;
    });
    expect(foundRow).not.toBeNull();
    // C col = 광고비 → accounting integer
    expect(foundRow!.getCell(3).numFmt).toBe(ACCT_INT);
    // F col = CTR → percent
    expect(foundRow!.getCell(6).numFmt).toBe("0.00%");
    // K col = 평균노출순위 → accounting decimal
    expect(foundRow!.getCell(11).numFmt).toBe(ACCT_DEC);
  });

  it("SUMMARY: column widths match reference [3.625, 11.75, 11.125, ...]", () => {
    const ref = refWb.getWorksheet("SUMMARY")!;
    const gen = genWb.getWorksheet("SUMMARY")!;
    for (let c = 1; c <= 11; c++) {
      expect(gen.getColumn(c).width).toBe(ref.getColumn(c).width);
    }
  });

  it("매체별 성과: column widths match reference", () => {
    const ref = refWb.getWorksheet("매체별 성과")!;
    const gen = genWb.getWorksheet("매체별 성과")!;
    for (let c = 1; c <= 11; c++) {
      expect(gen.getColumn(c).width).toBe(ref.getColumn(c).width);
    }
  });

  it("키워드 성과: column widths match reference", () => {
    const ref = refWb.getWorksheet("키워드 성과")!;
    const gen = genWb.getWorksheet("키워드 성과")!;
    for (let c = 1; c <= 11; c++) {
      expect(gen.getColumn(c).width).toBe(ref.getColumn(c).width);
    }
  });
});

// ---------------------------------------------------------------------------
// Pivot rows — (비어 있음) and 총합계 markers
// ---------------------------------------------------------------------------

describe("Reference parity: pivot artifact rows", () => {
  it("SUMMARY contains 3 '(비어 있음)' rows and 3 '총합계' rows", () => {
    const gen = genWb.getWorksheet("SUMMARY")!;
    let emptyCount = 0;
    let totalCount = 0;
    gen.eachRow((row) => {
      const v = row.getCell(2).value;
      if (v === "(비어 있음)") emptyCount++;
      if (v === "총합계") totalCount++;
    });
    expect(emptyCount).toBe(3);
    expect(totalCount).toBe(3);
  });

  it("매체별 성과 has 3 '(비어 있음)' rows (one per sub-section)", () => {
    const gen = genWb.getWorksheet("매체별 성과")!;
    let emptyCount = 0;
    gen.eachRow((row) => {
      if (row.getCell(2).value === "(비어 있음)") emptyCount++;
    });
    expect(emptyCount).toBe(3);
  });

  it("매체별 성과 does NOT have 총합계 (matches reference)", () => {
    const gen = genWb.getWorksheet("매체별 성과")!;
    let totalCount = 0;
    gen.eachRow((row) => {
      if (row.getCell(2).value === "총합계") totalCount++;
    });
    expect(totalCount).toBe(0);
  });
});
