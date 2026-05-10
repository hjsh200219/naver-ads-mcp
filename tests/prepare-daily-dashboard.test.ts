import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { mkdtempSync, rmSync, existsSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { createServer } from "../src/mcp/server.js";
import type { DailyPayload } from "../src/parser/aggregate-daily.js";
import type { ClientMappingsFile } from "../src/config/client-mappings.js";

let workDir: string;
let consoleSpy: ReturnType<typeof vi.spyOn>;

const stubClient = {
  get: async () => ({}),
  post: async () => ({}),
} as unknown as Parameters<typeof createServer>[0]["client"];

const MAPPINGS: ClientMappingsFile = {
  mappings: [
    {
      client_id: "client-a",
      display_name: "Client A",
      customer_id: "11111",
      recipients: [],
      cc: [],
      automation_enabled: true,
    },
    {
      client_id: "client-b",
      display_name: "Client B",
      customer_id: "22222",
      recipients: [],
      cc: [],
      automation_enabled: true,
      daily_thresholds: { roas_mom_pct: -10 },
    },
    {
      client_id: "client-c",
      display_name: "Client C",
      customer_id: "33333",
      recipients: [],
      cc: [],
      automation_enabled: true,
    },
  ],
};

function cleanPayload(advertiser: string): DailyPayload {
  return {
    advertiser,
    target_date: "2026-05-08",
    compare_dod_date: "2026-05-07",
    compare_mom_date: "2026-04-08",
    kpi_target: {
      impressions: 1000,
      clicks: 50,
      cost: 10000,
      conversions: 5,
      revenue: 50000,
      roas: 500,
    },
    kpi_dod: {
      impressions: 1000,
      clicks: 50,
      cost: 10000,
      conversions: 5,
      revenue: 50000,
      roas: 500,
    },
    kpi_mom: {
      impressions: 1000,
      clicks: 50,
      cost: 10000,
      conversions: 5,
      revenue: 50000,
      roas: 500,
    },
    deltas: {
      dod_pct: {
        impressions_pct: 0,
        clicks_pct: 0,
        cost_pct: 0,
        conversions_pct: 0,
        revenue_pct: 0,
        roas_pct: 0,
      },
      mom_pct: {
        impressions_pct: 0,
        clicks_pct: 0,
        cost_pct: 0,
        conversions_pct: 0,
        revenue_pct: 0,
        roas_pct: 0,
      },
    },
    derived: { roas_mom_pct: 0, cpc_mom_pct: 0, impressions_dod_pct: 0 },
    data_warnings: [],
  };
}

function breachedPayload(advertiser: string): DailyPayload {
  return {
    ...cleanPayload(advertiser),
    derived: {
      roas_mom_pct: -50,
      cpc_mom_pct: 100,
      impressions_dod_pct: -80,
    },
  };
}

beforeEach(() => {
  workDir = mkdtempSync(path.join(os.tmpdir(), "naver-ads-daily-"));
  consoleSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
});

afterEach(() => {
  if (existsSync(workDir)) rmSync(workDir, { recursive: true, force: true });
  consoleSpy.mockRestore();
});

describe("US-020 prepare_daily_dashboard MCP tool", () => {
  it("is registered in the tool list (count 6 → 7)", async () => {
    const { tools } = createServer({
      client: stubClient,
      clientMappings: MAPPINGS,
      historyBaseDir: workDir,
    });
    expect(Object.keys(tools)).toContain("prepare_daily_dashboard");
  });

  it("returns 0 violations when all clients are clean", async () => {
    const { tools } = createServer({
      client: stubClient,
      clientMappings: MAPPINGS,
      historyBaseDir: workDir,
      dailyPayloadProvider: async ({ client }: { client: string }) =>
        cleanPayload(client),
    });
    const result = (await tools.prepare_daily_dashboard({
      date: "2026-05-08",
    })) as {
      date: string;
      violations: unknown[];
      summary: { client: string; violation_count: number }[];
      data_warnings: string[];
    };
    expect(result.date).toBe("2026-05-08");
    expect(result.violations).toEqual([]);
    expect(result.summary.every((s) => s.violation_count === 0)).toBe(true);
    expect(consoleSpy).not.toHaveBeenCalled();
  });

  it("single-client breach: emits stdout warn + appends history with daily_prepared status", async () => {
    const { tools } = createServer({
      client: stubClient,
      clientMappings: MAPPINGS,
      historyBaseDir: workDir,
      dailyPayloadProvider: async ({ client }: { client: string }) =>
        client === "client-a" ? breachedPayload(client) : cleanPayload(client),
    });
    await tools.prepare_daily_dashboard({ date: "2026-05-08" });

    expect(consoleSpy).toHaveBeenCalledTimes(1);
    const logged = consoleSpy.mock.calls[0][0] as string;
    const parsed = JSON.parse(logged) as {
      level: string;
      op: string;
      total_violations: number;
      by_client: { client: string; violation_count: number }[];
    };
    expect(parsed.level).toBe("warn");
    expect(parsed.op).toBe("prepare_daily_dashboard");
    expect(parsed.total_violations).toBeGreaterThan(0);
    expect(parsed.by_client[0].client).toBe("client-a");

    const { readHistory } = await import("../src/runtime/history.js");
    const entries = await readHistory({
      baseDir: workDir,
      client: "client-a",
      week: "2026-05-08",
    });
    expect(entries.length).toBeGreaterThanOrEqual(1);
    expect(entries[0].status).toBe("daily_prepared");
  });

  it("sorts summary by violation_count descending", async () => {
    const { tools } = createServer({
      client: stubClient,
      clientMappings: MAPPINGS,
      historyBaseDir: workDir,
      dailyPayloadProvider: async ({ client }: { client: string }) => {
        if (client === "client-a") {
          // 3 violations
          return {
            ...cleanPayload(client),
            derived: {
              roas_mom_pct: -50,
              cpc_mom_pct: 100,
              impressions_dod_pct: -80,
            },
          };
        }
        if (client === "client-b") {
          // 1 violation: roas_mom -15 against override -10
          return {
            ...cleanPayload(client),
            derived: {
              roas_mom_pct: -15,
              cpc_mom_pct: 0,
              impressions_dod_pct: 0,
            },
          };
        }
        return cleanPayload(client);
      },
    });
    const result = (await tools.prepare_daily_dashboard({
      date: "2026-05-08",
    })) as { summary: { client: string; violation_count: number }[] };
    expect(result.summary[0].client).toBe("client-a");
    expect(result.summary[0].violation_count).toBe(3);
    expect(result.summary[1].client).toBe("client-b");
    expect(result.summary[1].violation_count).toBe(1);
  });

  it("honors per-client daily_thresholds override (client-b roas_mom_pct -10)", async () => {
    // client-b override = -10. Default = -20. Actual -15 must breach override (worse than -10)
    // but would NOT breach default (-15 is better than -20).
    const { tools } = createServer({
      client: stubClient,
      clientMappings: MAPPINGS,
      historyBaseDir: workDir,
      dailyPayloadProvider: async ({ client }: { client: string }) => {
        return {
          ...cleanPayload(client),
          derived: {
            roas_mom_pct: -15,
            cpc_mom_pct: 0,
            impressions_dod_pct: 0,
          },
        };
      },
    });
    const result = (await tools.prepare_daily_dashboard({
      date: "2026-05-08",
    })) as { summary: { client: string; violation_count: number }[] };
    // client-b should breach (override -10), others should not (default -20).
    const b = result.summary.find((s) => s.client === "client-b");
    const a = result.summary.find((s) => s.client === "client-a");
    expect(b?.violation_count).toBe(1);
    expect(a?.violation_count).toBe(0);
  });

  it("propagates data_warnings from aggregateDailyPayload", async () => {
    const { tools } = createServer({
      client: stubClient,
      clientMappings: MAPPINGS,
      historyBaseDir: workDir,
      dailyPayloadProvider: async ({ client }: { client: string }) => ({
        ...cleanPayload(client),
        data_warnings: client === "client-a" ? ["D-1 데이터 없음"] : [],
      }),
    });
    const result = (await tools.prepare_daily_dashboard({
      date: "2026-05-08",
    })) as { data_warnings: string[] };
    expect(result.data_warnings).toContain("client-a: D-1 데이터 없음");
  });

  it("daily_prepared entries are surfaced through naver-ads://history/{client}", async () => {
    const { server, tools } = createServer({
      client: stubClient,
      clientMappings: MAPPINGS,
      historyBaseDir: workDir,
      dailyPayloadProvider: async ({ client }: { client: string }) =>
        client === "client-a" ? breachedPayload(client) : cleanPayload(client),
    });
    await tools.prepare_daily_dashboard({ date: "2026-05-08" });

    const { ReadResourceRequestSchema } =
      await import("@modelcontextprotocol/sdk/types.js");
    const handler = (
      server as unknown as { _requestHandlers: Map<string, unknown> }
    )._requestHandlers.get(ReadResourceRequestSchema.shape.method.value) as
      | ((
          req: { method: string; params: unknown },
          ctx: unknown,
        ) => Promise<{
          contents: { text: string }[];
        }>)
      | undefined;
    if (!handler) throw new Error("no read-resource handler");
    const res = await handler(
      {
        method: ReadResourceRequestSchema.shape.method.value,
        params: { uri: "naver-ads://history/client-a" },
      },
      {},
    );
    const text = res.contents[0].text;
    expect(text).toContain("daily_prepared");
  });

  it("completes for 6 mocked clients within 5 seconds", async () => {
    const sixMappings: ClientMappingsFile = {
      mappings: Array.from({ length: 6 }, (_, i) => ({
        client_id: `client-${i + 1}`,
        display_name: `Client ${i + 1}`,
        customer_id: String(10000 + i),
        recipients: [],
        cc: [],
        automation_enabled: true,
      })),
    };
    const { tools } = createServer({
      client: stubClient,
      clientMappings: sixMappings,
      historyBaseDir: workDir,
      dailyPayloadProvider: async ({ client }: { client: string }) =>
        cleanPayload(client),
    });
    const t0 = Date.now();
    await tools.prepare_daily_dashboard({ date: "2026-05-08" });
    expect(Date.now() - t0).toBeLessThan(5000);
  });
});
