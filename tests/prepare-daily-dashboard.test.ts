import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { mkdtempSync, rmSync, existsSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { createServer } from "../src/mcp/server.js";
import type { DailyPayload } from "../src/parser/aggregate-daily.js";
import {
  MapAccountStore,
  type IAccountStore,
} from "../src/config/account-store.js";
import type { NaverAdsCredentials } from "../src/config/credentials.js";

let workDir: string;
let consoleSpy: ReturnType<typeof vi.spyOn>;

const stubClient = {
  get: async () => ({}),
  post: async () => ({}),
} as unknown as Parameters<typeof createServer>[0]["client"];

const FAKE_CRED = (cid: string): NaverAdsCredentials => ({
  customerId: cid,
  accessLicense: "AKEY",
  secretKey: "SKEY",
});

function makeAccounts(names: string[]): IAccountStore {
  const accounts = new Map(
    names.map((n, i) => [n, FAKE_CRED(String(11111 + i * 11111))]),
  );
  return new MapAccountStore({ accounts, defaultName: names[0] });
}

const DEFAULT_CLIENT_IDS = ["client-a", "client-b", "client-c"];

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
      accountStore: makeAccounts(DEFAULT_CLIENT_IDS),
      historyBaseDir: workDir,
    });
    expect(Object.keys(tools)).toContain("prepare_daily_dashboard");
  });

  it("returns 0 violations when all clients are clean", async () => {
    const { tools } = createServer({
      client: stubClient,
      accountStore: makeAccounts(DEFAULT_CLIENT_IDS),
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

  it("appends one history entry per client even when violations=0 (PRD US-020 AC)", async () => {
    const { tools } = createServer({
      client: stubClient,
      accountStore: makeAccounts(DEFAULT_CLIENT_IDS),
      historyBaseDir: workDir,
      dailyPayloadProvider: async ({ client }: { client: string }) =>
        cleanPayload(client),
    });
    await tools.prepare_daily_dashboard({ date: "2026-05-08" });

    const { readHistory } = await import("../src/runtime/history.js");
    for (const clientId of DEFAULT_CLIENT_IDS) {
      const entries = await readHistory({
        baseDir: workDir,
        client: clientId,
        week: "2026-05-08",
      });
      expect(entries).toHaveLength(1);
      expect(entries[0].status).toBe("daily_prepared");
      expect(entries[0].violation_count).toBe(0);
    }
  });

  it("single-client breach: emits stdout warn + appends history with daily_prepared status", async () => {
    const { tools } = createServer({
      client: stubClient,
      accountStore: makeAccounts(DEFAULT_CLIENT_IDS),
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
      accountStore: makeAccounts(DEFAULT_CLIENT_IDS),
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
          // 1 violation against default thresholds: roas_mom -25 (worse than -20)
          return {
            ...cleanPayload(client),
            derived: {
              roas_mom_pct: -25,
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

  it("propagates data_warnings from aggregateDailyPayload", async () => {
    const { tools } = createServer({
      client: stubClient,
      accountStore: makeAccounts(DEFAULT_CLIENT_IDS),
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
      accountStore: makeAccounts(DEFAULT_CLIENT_IDS),
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
    const sixIds = Array.from({ length: 6 }, (_, i) => `client-${i + 1}`);
    const { tools } = createServer({
      client: stubClient,
      accountStore: makeAccounts(sixIds),
      historyBaseDir: workDir,
      dailyPayloadProvider: async ({ client }: { client: string }) =>
        cleanPayload(client),
    });
    const t0 = Date.now();
    await tools.prepare_daily_dashboard({ date: "2026-05-08" });
    expect(Date.now() - t0).toBeLessThan(5000);
  });
});
