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

const stub = {
  get: async () => ({}),
  post: async () => ({}),
} as unknown as Parameters<typeof createServer>[0]["client"];

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

describe("weekly dashboard 3-tool pipeline", () => {
  it("tools/list registers prepare_weekly_payload, generate_weekly_analysis_prompt, finalize_weekly_dashboard", async () => {
    const { server } = createServer({
      client: stub,
      historyBaseDir: workDir,
      reportsBaseDir: workDir,
      payloadProvider: async () => SAMPLE_PAYLOAD,
    });
    const out = await callHandler<{ tools: { name: string }[] }>(
      server as unknown as { _requestHandlers: Map<string, unknown> },
      ListToolsRequestSchema.shape.method.value,
    );
    const names = out.tools.map((t) => t.name);
    expect(names).toContain("prepare_weekly_payload");
    expect(names).toContain("generate_weekly_analysis_prompt");
    expect(names).toContain("finalize_weekly_dashboard");
    expect(names).not.toContain("prepare_weekly_dashboard");
  });
});

describe("prepare_weekly_payload", () => {
  it("returns payload + payload_summary_md via payloadProvider", async () => {
    const { tools } = createServer({
      client: stub,
      historyBaseDir: workDir,
      reportsBaseDir: workDir,
      payloadProvider: async () => SAMPLE_PAYLOAD,
    });
    const r = (await tools.prepare_weekly_payload({
      client: "bishef",
      week: "2026-W17",
    })) as { payload: PrecomputedPayload; payload_summary_md: string };
    expect(r.payload.advertiser).toBe("비셰프");
    expect(r.payload_summary_md).toContain("비셰프");
    expect(r.payload_summary_md).toContain("ROAS");
  });

  it("returns payload via xlsx parser path", async () => {
    const { tools } = createServer({
      client: stub,
      historyBaseDir: workDir,
      reportsBaseDir: workDir,
    });
    const xlsxPath = path.resolve(
      "tests/fixtures/anonymized/client-a-form.xlsx",
    );
    const r = (await tools.prepare_weekly_payload({
      client: "client-a",
      week: "2026-W18",
      xlsxPath,
      targetWeekLabel: "2026-05-04주차",
      compareWeekLabel: "2026-04-27주차",
    })) as { payload: PrecomputedPayload };
    expect(r.payload.advertiser).toBe("client-a");
  });

  it("rejects when neither payloadProvider nor xlsxPath args are provided", async () => {
    const { tools } = createServer({
      client: stub,
      historyBaseDir: workDir,
      reportsBaseDir: workDir,
    });
    await expect(
      tools.prepare_weekly_payload({ client: "bishef", week: "2026-W17" }),
    ).rejects.toThrow();
  });

  it("propagates data_warnings inside the payload", async () => {
    const warned: PrecomputedPayload = {
      ...SAMPLE_PAYLOAD,
      data_warnings: ["브랜드검색 영역별 성과: Naver API 미제공"],
    };
    const { tools } = createServer({
      client: stub,
      historyBaseDir: workDir,
      reportsBaseDir: workDir,
      payloadProvider: async () => warned,
    });
    const r = (await tools.prepare_weekly_payload({
      client: "bishef",
      week: "2026-W17",
    })) as { payload: PrecomputedPayload; payload_summary_md: string };
    expect(r.payload.data_warnings).toContain(
      "브랜드검색 영역별 성과: Naver API 미제공",
    );
    expect(r.payload_summary_md).toContain("데이터 경고");
  });
});

describe("generate_weekly_analysis_prompt", () => {
  it("returns system_prompt, user_prompt, expected_schema", async () => {
    const { tools } = createServer({
      client: stub,
      historyBaseDir: workDir,
      reportsBaseDir: workDir,
    });
    const r = (await tools.generate_weekly_analysis_prompt({
      payload: SAMPLE_PAYLOAD,
    })) as {
      system_prompt: string;
      user_prompt: string;
      expected_schema: Record<string, unknown>;
    };
    expect(r.system_prompt).toContain("네이버 검색광고");
    expect(JSON.parse(r.user_prompt).advertiser).toBe("비셰프");
    expect(r.expected_schema.type).toBe("object");
    expect((r.expected_schema as { required: string[] }).required).toContain(
      "review_text",
    );
  });

  it("rejects malformed payload via zod", async () => {
    const { server } = createServer({
      client: stub,
      historyBaseDir: workDir,
      reportsBaseDir: workDir,
    });
    const out = await callHandler<{
      content: Array<{ text: string }>;
      isError?: boolean;
    }>(
      server as unknown as { _requestHandlers: Map<string, unknown> },
      CallToolRequestSchema.shape.method.value,
      {
        name: "generate_weekly_analysis_prompt",
        arguments: { payload: { advertiser: "x" } },
      },
    );
    expect(out.isError).toBe(true);
  });
});

describe("finalize_weekly_dashboard", () => {
  it("writes html + xlsx + history and returns artifact_html + payload_hash", async () => {
    const { tools } = createServer({
      client: stub,
      historyBaseDir: workDir,
      reportsBaseDir: workDir,
    });
    const r = (await tools.finalize_weekly_dashboard({
      client: "bishef",
      week: "2026-W17",
      payload: SAMPLE_PAYLOAD,
      ai_analysis: SAMPLE_AI,
    })) as {
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

    const { readHistory } = await import("../src/runtime/history.js");
    const entries = await readHistory({
      baseDir: workDir,
      client: "bishef",
      week: "2026-W17",
    });
    expect(entries).toHaveLength(1);
    expect(entries[0].status).toBe("prepared");
  });

  it("status becomes corrected_prepared when correction=true", async () => {
    const { tools } = createServer({
      client: stub,
      historyBaseDir: workDir,
      reportsBaseDir: workDir,
    });
    await tools.finalize_weekly_dashboard({
      client: "bishef",
      week: "2026-W17",
      payload: SAMPLE_PAYLOAD,
      ai_analysis: SAMPLE_AI,
      correction: true,
    });
    const { readHistory } = await import("../src/runtime/history.js");
    const entries = await readHistory({
      baseDir: workDir,
      client: "bishef",
      week: "2026-W17",
    });
    expect(entries[0].status).toBe("corrected_prepared");
  });

  it("merges payload.data_warnings and ai_analysis.data_warnings", async () => {
    const { tools } = createServer({
      client: stub,
      historyBaseDir: workDir,
      reportsBaseDir: workDir,
    });
    const r = (await tools.finalize_weekly_dashboard({
      client: "bishef",
      week: "2026-W17",
      payload: { ...SAMPLE_PAYLOAD, data_warnings: ["payload-warn"] },
      ai_analysis: { ...SAMPLE_AI, data_warnings: ["ai-warn"] },
    })) as { data_warnings: string[] };
    expect(r.data_warnings).toContain("payload-warn");
    expect(r.data_warnings).toContain("ai-warn");
  });

  it("rejects when ai_analysis is missing required fields", async () => {
    const { server } = createServer({
      client: stub,
      historyBaseDir: workDir,
      reportsBaseDir: workDir,
    });
    const out = await callHandler<{
      content: Array<{ text: string }>;
      isError?: boolean;
    }>(
      server as unknown as { _requestHandlers: Map<string, unknown> },
      CallToolRequestSchema.shape.method.value,
      {
        name: "finalize_weekly_dashboard",
        arguments: {
          client: "bishef",
          week: "2026-W17",
          payload: SAMPLE_PAYLOAD,
          ai_analysis: { review_text: "x" },
        },
      },
    );
    expect(out.isError).toBe(true);
  });

  it("rejects malformed client id via zod", async () => {
    const { server } = createServer({
      client: stub,
      historyBaseDir: workDir,
      reportsBaseDir: workDir,
    });
    const out = await callHandler<{
      content: Array<{ text: string }>;
      isError?: boolean;
    }>(
      server as unknown as { _requestHandlers: Map<string, unknown> },
      CallToolRequestSchema.shape.method.value,
      {
        name: "finalize_weekly_dashboard",
        arguments: {
          client: "Bad_Client",
          week: "2026-W17",
          payload: SAMPLE_PAYLOAD,
          ai_analysis: SAMPLE_AI,
        },
      },
    );
    expect(out.isError).toBe(true);
  });
});
