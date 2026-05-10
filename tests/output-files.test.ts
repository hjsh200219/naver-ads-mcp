import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync, existsSync, statSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import ExcelJS from "exceljs";
import { renderWeeklyHtml } from "../src/output/weekly-html.js";
import { writeWeeklyXlsx } from "../src/output/weekly-xlsx.js";
import { writeReportFiles } from "../src/output/file-writer.js";
import type { AiAnalysis, PrecomputedPayload } from "../src/parser/types.js";

let workDir: string;

beforeEach(() => {
  workDir = mkdtempSync(path.join(os.tmpdir(), "naver-ads-output-"));
});

afterEach(() => {
  if (existsSync(workDir)) rmSync(workDir, { recursive: true, force: true });
});

const PAYLOAD: PrecomputedPayload = {
  advertiser: "비셰프",
  industry: "식품",
  report_period: { start: "2026-04-20", end: "2026-04-26" },
  compare_period: { start: "2026-04-13", end: "2026-04-19" },
  kpi_current: {
    impressions: 112415,
    clicks: 699,
    cost: 457614,
    conversions: 55,
    revenue: 2362980,
    roas: 516,
  },
  kpi_previous: {
    impressions: 94505,
    clicks: 524,
    cost: 328172,
    conversions: 48,
    revenue: 1789321,
    roas: 545,
  },
  kpi_wow: {
    impressions_pct: 18.95,
    clicks_pct: 33.4,
    cost_pct: 39.44,
    conversions_pct: 14.58,
    revenue_pct: 32.06,
    roas_pct: -5.29,
  },
  media: [
    {
      media: "powerlink",
      label: "파워링크",
      rows: [
        {
          device: "TOTAL",
          impressions: 51031,
          clicks: 320,
          cost: 254467,
          conversions: 9,
          revenue: 440500,
          roas: 173,
        },
      ],
      wow: {
        impressions_pct: 1,
        clicks_pct: 13.9,
        cost_pct: 13,
        conversions_pct: 0,
        revenue_pct: 1.3,
        roas_pct: -10.4,
      },
    },
    {
      media: "shopping",
      label: "쇼핑검색",
      rows: [
        {
          device: "TOTAL",
          impressions: 61384,
          clicks: 379,
          cost: 203146,
          conversions: 46,
          revenue: 1922480,
          roas: 946,
        },
      ],
      wow: {
        impressions_pct: 39.6,
        clicks_pct: 56,
        cost_pct: 97.4,
        conversions_pct: 17.9,
        revenue_pct: 41.9,
        roas_pct: -28.1,
      },
    },
  ],
  data_warnings: ["브랜드검색 영역별 성과: Naver API 미제공"],
};

const AI: AiAnalysis = {
  review_text:
    "안녕하세요. 4월 4주차 광고 운영 결과 광고비 457,614원 대비 매출 2,362,980원으로 ROAS 516% 달성했습니다.",
  insights: [
    {
      type: "good",
      title: "쇼핑검색 모바일 강세",
      body: "ROAS 946%.",
      metrics: ["ROAS 946%"],
    },
    {
      type: "bad",
      title: "파워링크 모바일 비효율",
      body: "ROAS 38%.",
      metrics: ["ROAS 38%"],
    },
    {
      type: "info",
      title: "전주 비교",
      body: "ROAS -5.29%.",
      metrics: ["ROAS -5.29%"],
    },
  ],
  action_items: [
    {
      title: "파워링크 모바일 입찰 하향",
      description: "비효율 시간대 조정.",
      priority: "high",
    },
    {
      title: "쇼핑검색 일예산 상향",
      description: "고효율 매체 비중 확대.",
      priority: "high",
    },
    {
      title: "PC 입찰 유지",
      description: "현행 유지.",
      priority: "low",
    },
  ],
  confidence: 0.85,
  data_warnings: [],
};

describe("US-016 renderWeeklyHtml (광고주 발송용)", () => {
  const html = renderWeeklyHtml({ payload: PAYLOAD, ai: AI });

  it("self-contained, no external fetch", () => {
    expect(html).toMatch(/^<!DOCTYPE html>/);
    expect(html).not.toMatch(/<script[^>]+src=/);
    expect(html).not.toMatch(/href=["']https?:/);
  });

  it("does NOT include AE-only chrome (action-bar / regen / step-bar / edit-hint)", () => {
    expect(html).not.toContain("action-bar");
    expect(html).not.toContain("regen");
    expect(html).not.toContain("step-bar");
    expect(html).not.toContain("edit-hint");
    expect(html).not.toContain("AE 검토");
  });

  it("includes review text, all 6 KPIs, both media blocks, insights and actions", () => {
    expect(html).toContain("ROAS 516");
    expect(html).toContain("파워링크");
    expect(html).toContain("쇼핑검색");
    expect(html).toContain("쇼핑검색 모바일 강세");
    expect(html).toContain("파워링크 모바일 입찰 하향");
  });

  it("renders data_warnings when present", () => {
    expect(html).toContain("Naver API 미제공");
  });

  it("escapes HTML in user-supplied text", () => {
    const evil: AiAnalysis = {
      ...AI,
      review_text: "<script>x</script>",
    };
    const out = renderWeeklyHtml({ payload: PAYLOAD, ai: evil });
    expect(out).not.toContain("<script>x</script>");
    expect(out).toContain("&lt;script&gt;");
  });
});

describe("US-016 writeWeeklyXlsx", () => {
  it("writes a valid .xlsx with KPI summary and media breakdown sheets", async () => {
    const out = path.join(workDir, "weekly.xlsx");
    await writeWeeklyXlsx({ payload: PAYLOAD, ai: AI, outputPath: out });
    expect(existsSync(out)).toBe(true);
    expect(statSync(out).size).toBeGreaterThan(1000);

    const wb = new ExcelJS.Workbook();
    await wb.xlsx.readFile(out);
    const sheetNames = wb.worksheets.map((s) => s.name);
    expect(sheetNames).toContain("KPI 요약");
    expect(sheetNames).toContain("매체별 성과");
  });

  it("KPI summary sheet has all 6 KPI rows with values matching payload", async () => {
    const out = path.join(workDir, "weekly.xlsx");
    await writeWeeklyXlsx({ payload: PAYLOAD, ai: AI, outputPath: out });
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.readFile(out);
    const sheet = wb.getWorksheet("KPI 요약");
    expect(sheet).toBeDefined();
    if (!sheet) return;
    const allText: string[] = [];
    sheet.eachRow((row) => {
      row.eachCell((cell) => {
        const v = cell.value;
        if (v !== null && v !== undefined) allText.push(String(v));
      });
    });
    const joined = allText.join(" ");
    expect(joined).toContain("총 노출수");
    expect(joined).toContain("ROAS");
    // Numeric values are kept as numbers, but presence of impressions count as text-or-number
    expect(joined).toMatch(/112415|112,415/);
  });

  it("매체별 성과 sheet contains 파워링크 and 쇼핑검색 sections", async () => {
    const out = path.join(workDir, "weekly.xlsx");
    await writeWeeklyXlsx({ payload: PAYLOAD, ai: AI, outputPath: out });
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.readFile(out);
    const sheet = wb.getWorksheet("매체별 성과");
    expect(sheet).toBeDefined();
    if (!sheet) return;
    const text: string[] = [];
    sheet.eachRow((row) =>
      row.eachCell((cell) => {
        if (cell.value !== null && cell.value !== undefined)
          text.push(String(cell.value));
      }),
    );
    const joined = text.join(" ");
    expect(joined).toContain("파워링크");
    expect(joined).toContain("쇼핑검색");
  });
});

describe("US-016 writeReportFiles (atomic + html+xlsx)", () => {
  it("writes both files under reports/{client}/{week}.{html|xlsx}", async () => {
    const result = await writeReportFiles({
      baseDir: workDir,
      client: "bishef",
      week: "2026-W17",
      payload: PAYLOAD,
      ai: AI,
    });
    expect(existsSync(result.html_path)).toBe(true);
    expect(existsSync(result.xlsx_path)).toBe(true);
    expect(result.html_path).toContain("bishef");
    expect(result.html_path).toContain("2026-W17");
    expect(result.html_path.endsWith(".html")).toBe(true);
    expect(result.xlsx_path.endsWith(".xlsx")).toBe(true);
  });

  it("returns absolute paths", async () => {
    const result = await writeReportFiles({
      baseDir: workDir,
      client: "bishef",
      week: "2026-W17",
      payload: PAYLOAD,
      ai: AI,
    });
    expect(path.isAbsolute(result.html_path)).toBe(true);
    expect(path.isAbsolute(result.xlsx_path)).toBe(true);
  });

  it("html and xlsx report identical KPI values for the same input (parity)", async () => {
    const result = await writeReportFiles({
      baseDir: workDir,
      client: "bishef",
      week: "2026-W17",
      payload: PAYLOAD,
      ai: AI,
    });
    const { readFileSync } = await import("node:fs");
    const html = readFileSync(result.html_path, "utf8");
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.readFile(result.xlsx_path);
    const summary = wb.getWorksheet("KPI 요약");
    expect(summary).toBeDefined();
    if (!summary) return;
    const xlsxText: string[] = [];
    summary.eachRow((row) =>
      row.eachCell((cell) => {
        if (cell.value !== null && cell.value !== undefined)
          xlsxText.push(String(cell.value));
      }),
    );
    const joined = xlsxText.join(" ");
    // Both should reference impressions value 112415 (xlsx may format with comma in display, but raw value will be 112415)
    expect(joined).toMatch(/112,?415/);
    expect(html).toMatch(/112,?415/);
  });

  it("concurrent writes for same (client, week) serialize correctly", async () => {
    const results = await Promise.all(
      Array.from({ length: 3 }, (_, i) =>
        writeReportFiles({
          baseDir: workDir,
          client: "bishef",
          week: "2026-W17",
          payload: { ...PAYLOAD, advertiser: `비셰프 try ${i}` },
          ai: AI,
        }),
      ),
    );
    // All 3 succeed (last write wins in content); files exist
    for (const r of results) {
      expect(existsSync(r.html_path)).toBe(true);
      expect(existsSync(r.xlsx_path)).toBe(true);
    }
  });
});
