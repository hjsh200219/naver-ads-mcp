import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync, existsSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { createServer } from "../src/mcp/server.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import type { AiAnalysis, PrecomputedPayload } from "../src/parser/types.js";
import type { IAnthropic } from "../src/analyzer/ai-comment.js";

let workDir: string;

beforeEach(() => {
  workDir = mkdtempSync(path.join(os.tmpdir(), "naver-ads-prepare-"));
});

afterEach(() => {
  if (existsSync(workDir)) rmSync(workDir, { recursive: true, force: true });
});

const SAMPLE_AI: AiAnalysis = {
  review_text:
    "안녕하세요. 4월 4주차 광고비 457,614원 대비 매출 2,362,980원 ROAS 516%.",
  insights: [
    {
      type: "good",
      title: "쇼핑검색 강세",
      body: "ROAS 946%.",
      metrics: ["ROAS 946%"],
    },
    {
      type: "bad",
      title: "파워링크 비효율",
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
    { title: "PL 입찰 하향", description: "비효율 조정.", priority: "high" },
    { title: "SS 일예산 상향", description: "고효율 매체.", priority: "high" },
    { title: "PC 유지", description: "효율 유지.", priority: "low" },
  ],
  confidence: 0.85,
  data_warnings: [],
};

const SAMPLE_PAYLOAD: PrecomputedPayload = {
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
  data_warnings: [],
};

const mockAnthropic: IAnthropic = {
  generate: async () => ({
    content: JSON.stringify(SAMPLE_AI),
    cache_hit: false,
  }),
};

async function callHandler<T>(
  server: { _requestHandlers: Map<string, unknown> },
  method: string,
  params: Record<string, unknown> = {},
): Promise<T> {
  const handler = server._requestHandlers.get(method) as
    | ((req: { method: string; params: unknown }, ctx: unknown) => Promise<T>)
    | undefined;
  if (!handler) throw new Error(`No handler for ${method}`);
  return await handler({ method, params }, {});
}

describe("US-016 prepare_weekly_dashboard MCP tool", () => {
  it("is registered in the tool list", async () => {
    const stub = {
      get: async () => ({}),
      post: async () => ({}),
    } as unknown as Parameters<typeof createServer>[0]["client"];
    const { server } = createServer({
      client: stub,
      anthropic: mockAnthropic,
      historyBaseDir: workDir,
      payloadProvider: async () => SAMPLE_PAYLOAD,
    });
    const out = await callHandler<{ tools: { name: string }[] }>(
      server as unknown as { _requestHandlers: Map<string, unknown> },
      ListToolsRequestSchema.shape.method.value,
    );
    const names = out.tools.map((t) => t.name);
    expect(names).toContain("prepare_weekly_dashboard");
  });

  it("end-to-end: returns artifact_html + html_path + xlsx_path + payload_hash + data_warnings", async () => {
    const stub = {
      get: async () => ({}),
      post: async () => ({}),
    } as unknown as Parameters<typeof createServer>[0]["client"];
    const { tools } = createServer({
      client: stub,
      anthropic: mockAnthropic,
      historyBaseDir: workDir,
      payloadProvider: async () => SAMPLE_PAYLOAD,
    });
    const result = await tools.prepare_weekly_dashboard({
      client: "bishef",
      week: "2026-W17",
    });
    const r = result as {
      artifact_html: string;
      html_path: string;
      xlsx_path: string;
      payload_hash: string;
      data_warnings: string[];
    };
    expect(r.artifact_html).toContain("비셰프");
    expect(existsSync(r.html_path)).toBe(true);
    expect(existsSync(r.xlsx_path)).toBe(true);
    expect(r.payload_hash).toMatch(/^[0-9a-f]{64}$/);
    expect(r.data_warnings).toBeDefined();
  });

  it("appends a history JSONL entry per prepare call", async () => {
    const stub = {
      get: async () => ({}),
      post: async () => ({}),
    } as unknown as Parameters<typeof createServer>[0]["client"];
    const { tools } = createServer({
      client: stub,
      anthropic: mockAnthropic,
      historyBaseDir: workDir,
      payloadProvider: async () => SAMPLE_PAYLOAD,
    });
    await tools.prepare_weekly_dashboard({
      client: "bishef",
      week: "2026-W17",
    });
    const { readHistory } = await import("../src/runtime/history.js");
    const entries = await readHistory({
      baseDir: workDir,
      client: "bishef",
      week: "2026-W17",
    });
    expect(entries).toHaveLength(1);
    expect(entries[0].status).toBe("prepared");
    expect(entries[0].html_path).toMatch(/\.html$/);
    expect(entries[0].xlsx_path).toMatch(/\.xlsx$/);
  });

  it("rejects malformed args via zod", async () => {
    const stub = {
      get: async () => ({}),
      post: async () => ({}),
    } as unknown as Parameters<typeof createServer>[0]["client"];
    const { server } = createServer({
      client: stub,
      anthropic: mockAnthropic,
      historyBaseDir: workDir,
      payloadProvider: async () => SAMPLE_PAYLOAD,
    });
    const out = await callHandler<{
      content: Array<{ text: string }>;
      isError?: boolean;
    }>(
      server as unknown as { _requestHandlers: Map<string, unknown> },
      CallToolRequestSchema.shape.method.value,
      {
        name: "prepare_weekly_dashboard",
        arguments: { client: "Bad_Client", week: "2026-W17" },
      },
    );
    expect(out.isError).toBe(true);
  });

  it("includes data_warnings from payload in the result", async () => {
    const warnedPayload: PrecomputedPayload = {
      ...SAMPLE_PAYLOAD,
      data_warnings: ["브랜드검색 영역별 성과: Naver API 미제공"],
    };
    const stub = {
      get: async () => ({}),
      post: async () => ({}),
    } as unknown as Parameters<typeof createServer>[0]["client"];
    const { tools } = createServer({
      client: stub,
      anthropic: mockAnthropic,
      historyBaseDir: workDir,
      payloadProvider: async () => warnedPayload,
    });
    const result = (await tools.prepare_weekly_dashboard({
      client: "bishef",
      week: "2026-W17",
    })) as { data_warnings: string[] };
    expect(result.data_warnings).toContain(
      "브랜드검색 영역별 성과: Naver API 미제공",
    );
  });

  it("end-to-end via xlsx parser path (no payloadProvider): xlsxPath + targetWeekLabel + compareWeekLabel", async () => {
    const stub = {
      get: async () => ({}),
      post: async () => ({}),
    } as unknown as Parameters<typeof createServer>[0]["client"];
    const { tools } = createServer({
      client: stub,
      anthropic: mockAnthropic,
      historyBaseDir: workDir,
      reportsBaseDir: workDir,
      // No payloadProvider — exercises the parser path
    });
    const xlsxPath = path.resolve(
      "tests/fixtures/anonymized/client-a-form.xlsx",
    );
    const result = (await tools.prepare_weekly_dashboard({
      client: "client-a",
      week: "2026-W18",
      xlsxPath,
      targetWeekLabel: "2026-05-04주차",
      compareWeekLabel: "2026-04-27주차",
    })) as { html_path: string; xlsx_path: string; payload_hash: string };
    expect(existsSync(result.html_path)).toBe(true);
    expect(existsSync(result.xlsx_path)).toBe(true);
    expect(result.payload_hash).toMatch(/^[0-9a-f]{64}$/);
  });

  it("rejects when neither payloadProvider nor xlsxPath args are provided", async () => {
    const stub = {
      get: async () => ({}),
      post: async () => ({}),
    } as unknown as Parameters<typeof createServer>[0]["client"];
    const { tools } = createServer({
      client: stub,
      anthropic: mockAnthropic,
      historyBaseDir: workDir,
      reportsBaseDir: workDir,
    });
    await expect(
      tools.prepare_weekly_dashboard({ client: "bishef", week: "2026-W17" }),
    ).rejects.toThrow();
  });

  it("anthropicFactory path: lazy construction at first tool use (cli.ts wiring smoke)", async () => {
    const stub = {
      get: async () => ({}),
      post: async () => ({}),
    } as unknown as Parameters<typeof createServer>[0]["client"];
    let factoryCalls = 0;
    const factory = (): IAnthropic => {
      factoryCalls++;
      return mockAnthropic;
    };
    const { tools } = createServer({
      client: stub,
      anthropicFactory: factory,
      historyBaseDir: workDir,
      reportsBaseDir: workDir,
      payloadProvider: async () => SAMPLE_PAYLOAD,
    });
    // No factory call at boot
    expect(factoryCalls).toBe(0);
    await tools.prepare_weekly_dashboard({
      client: "bishef",
      week: "2026-W17",
    });
    expect(factoryCalls).toBe(1);
  });
});
