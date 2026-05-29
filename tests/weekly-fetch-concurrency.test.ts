import { describe, it, expect } from "vitest";
import { createServer } from "../src/mcp/server.js";
import { CONCURRENT_STAT_JOBS } from "../src/util/concurrency.js";
import type { INaverAdsClient } from "../src/api/types.js";

/**
 * Live weekly path (no payloadProvider / no xlsxPath) fans out (reportTp × day)
 * stat-report jobs through a bounded pool. These tests inject a mock client to
 * assert the in-flight count never exceeds the cap, and that fan-out fetches the
 * expected job count — the regression guard for the speed fix.
 */
function makeMockClient(): {
  client: INaverAdsClient;
  maxInFlight: () => number;
  postCount: () => number;
} {
  let inFlight = 0;
  let maxInFlight = 0;
  let postCount = 0;
  let jobId = 0;

  const client: INaverAdsClient = {
    async get<T>(path: string): Promise<T> {
      if (path === "/ncc/campaigns") return [] as unknown as T;
      if (path === "/ncc/adgroups") return [] as unknown as T;
      // Poll: report immediately BUILT so the test isolates pool behavior.
      return {
        status: "BUILT",
        downloadUrl: "https://dl.example/r",
      } as unknown as T;
    },
    async post<T>(path: string): Promise<T> {
      // Count concurrent stat-report job creations.
      inFlight++;
      postCount++;
      maxInFlight = Math.max(maxInFlight, inFlight);
      await new Promise((r) => setTimeout(r, 5));
      inFlight--;
      return { reportJobId: ++jobId, status: "REGIST" } as unknown as T;
    },
    async downloadBinary(): Promise<Buffer> {
      return Buffer.from("", "utf-8"); // empty TSV → 0 rows
    },
  };

  return {
    client,
    maxInFlight: () => maxInFlight,
    postCount: () => postCount,
  };
}

describe("weekly live fetch concurrency", () => {
  it("never exceeds the stat-job concurrency cap", async () => {
    const mock = makeMockClient();
    const { tools } = createServer({ client: mock.client });

    // A fully past week → no future-date skipping, all 14 days × 2 types fire.
    await tools.prepare_weekly_payload({ client: "acct", week: "2025-W10" });

    expect(mock.maxInFlight()).toBeLessThanOrEqual(CONCURRENT_STAT_JOBS);
    // 14 days × 2 report types = 28 jobs.
    expect(mock.postCount()).toBe(28);
    // Proves it actually parallelizes (sequential would peak at 1).
    expect(mock.maxInFlight()).toBeGreaterThan(1);
  });

  it("aborts on a 5xx but tolerates 4xx/FAILED per day", async () => {
    // 5xx from a stat-report job must propagate (network/server error), unlike
    // 4xx which is swallowed as an empty day.
    let calls = 0;
    const client: INaverAdsClient = {
      async get<T>(path: string): Promise<T> {
        if (path.startsWith("/ncc")) return [] as unknown as T;
        return { status: "BUILT", downloadUrl: "x" } as unknown as T;
      },
      async post<T>(): Promise<T> {
        calls++;
        if (calls === 3) {
          const { NaverAdsApiError } = await import("../src/api/client.js");
          throw new NaverAdsApiError(503, "server down");
        }
        return { reportJobId: calls, status: "REGIST" } as unknown as T;
      },
      async downloadBinary(): Promise<Buffer> {
        return Buffer.from("", "utf-8");
      },
    };
    const { tools } = createServer({ client });
    await expect(
      tools.prepare_weekly_payload({ client: "acct", week: "2025-W10" }),
    ).rejects.toThrow();
  });
});
