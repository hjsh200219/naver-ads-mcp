import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { gzipSync } from "node:zlib";
import type { INaverAdsClient } from "../src/api/types.js";
import {
  requestStatReport,
  parseTsv,
  REPORT_TYPES,
  StatReportTimeoutError,
  StatReportFailedError,
} from "../src/api/stat-reports.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeMockClient(
  postResponse: unknown,
  getResponses: unknown[],
): INaverAdsClient {
  let getCallIndex = 0;
  return {
    post: vi.fn(async () => postResponse),
    get: vi.fn(async () => {
      const resp = getResponses[getCallIndex];
      getCallIndex++;
      return resp;
    }),
  };
}

function makeGzBuffer(tsv: string): Buffer {
  return gzipSync(Buffer.from(tsv, "utf-8"));
}

function makeMockFetch(gzBuffer: Buffer): typeof globalThis.fetch {
  return vi.fn(async (_url: string | URL | Request) => {
    return {
      arrayBuffer: async () => gzBuffer.buffer.slice(
        gzBuffer.byteOffset,
        gzBuffer.byteOffset + gzBuffer.byteLength,
      ),
    } as unknown as Response;
  });
}

// ---------------------------------------------------------------------------
// US-005: REPORT_TYPES constant
// ---------------------------------------------------------------------------

describe("US-005 REPORT_TYPES", () => {
  it("exports all 10 report type strings", () => {
    expect(REPORT_TYPES).toHaveLength(10);
    expect(REPORT_TYPES).toContain("AD");
    expect(REPORT_TYPES).toContain("AD_DETAIL");
    expect(REPORT_TYPES).toContain("AD_CONVERSION");
    expect(REPORT_TYPES).toContain("AD_CONVERSION_DETAIL");
    expect(REPORT_TYPES).toContain("EXPKEYWORD");
    expect(REPORT_TYPES).toContain("SHOPPINGKEYWORD_DETAIL");
    expect(REPORT_TYPES).toContain("SHOPPINGKEYWORD_CONVERSION_DETAIL");
    expect(REPORT_TYPES).toContain("SHOPPINGBRANDPRODUCT");
    expect(REPORT_TYPES).toContain("SHOPPINGBRANDPRODUCT_CONVERSION");
    expect(REPORT_TYPES).toContain("BRND_CONTRACT");
  });
});

// ---------------------------------------------------------------------------
// US-005: parseTsv
// ---------------------------------------------------------------------------

describe("US-005 parseTsv()", () => {
  it("parses a simple TSV with header and one row", () => {
    const rows = parseTsv("header1\theader2\nval1\tval2\n");
    expect(rows).toHaveLength(1);
    expect(rows[0]).toEqual({ header1: "val1", header2: "val2" });
  });

  it("handles trailing newline without creating empty row", () => {
    const rows = parseTsv("h1\th2\nv1\tv2\n");
    expect(rows).toHaveLength(1);
  });

  it("handles empty string input", () => {
    const rows = parseTsv("");
    expect(rows).toHaveLength(0);
  });

  it("trims whitespace from headers", () => {
    const rows = parseTsv(" 키워드 \t 노출수 \n광고\t100\n");
    expect(rows[0]).toHaveProperty("키워드", "광고");
    expect(rows[0]).toHaveProperty("노출수", "100");
  });

  it("parses Korean TSV correctly", () => {
    const tsv = "키워드\t노출수\t클릭수\n광고\t100\t10\n";
    const rows = parseTsv(tsv);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toEqual({ 키워드: "광고", 노출수: "100", 클릭수: "10" });
  });

  it("handles multiple rows", () => {
    const tsv = "a\tb\nv1\tv2\nv3\tv4\n";
    const rows = parseTsv(tsv);
    expect(rows).toHaveLength(2);
    expect(rows[1]).toEqual({ a: "v3", b: "v4" });
  });
});

// ---------------------------------------------------------------------------
// US-005: requestStatReport — full flow
// ---------------------------------------------------------------------------

describe("US-005 requestStatReport()", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("sends POST /stat-reports with correct reportTp and statDt", async () => {
    const tsv = "header1\theader2\nval1\tval2\n";
    const gzBuffer = makeGzBuffer(tsv);
    const client = makeMockClient(
      { reportJobId: 42, status: "REGIST" },
      [
        { reportJobId: 42, status: "BUILT", downloadUrl: "https://example.com/dl" },
      ],
    );
    const mockFetch = makeMockFetch(gzBuffer);

    const promise = requestStatReport({
      client,
      reportTp: "AD_DETAIL",
      statDt: "20260501",
      fetch: mockFetch,
      poll: { initialDelayMs: 10, maxDelayMs: 100, totalTimeoutMs: 5_000 },
    });

    // Advance timers to handle polling sleep
    await vi.runAllTimersAsync();
    const result = await promise;

    expect(client.post).toHaveBeenCalledWith("/stat-reports", {
      reportTp: "AD_DETAIL",
      statDt: "20260501",
    });
    expect(result.reportTp).toBe("AD_DETAIL");
    expect(result.statDt).toBe("20260501");
    expect(result.reportJobId).toBe(42);
  });

  it("polls GET until status=BUILT (REGIST → RUNNING → BUILT across 3 calls)", async () => {
    const tsv = "header1\theader2\nval1\tval2\n";
    const gzBuffer = makeGzBuffer(tsv);
    const client = makeMockClient(
      { reportJobId: 99, status: "REGIST" },
      [
        { reportJobId: 99, status: "REGIST" },
        { reportJobId: 99, status: "RUNNING" },
        { reportJobId: 99, status: "BUILT", downloadUrl: "https://example.com/dl" },
      ],
    );
    const mockFetch = makeMockFetch(gzBuffer);

    const promise = requestStatReport({
      client,
      reportTp: "AD_DETAIL",
      statDt: "20260501",
      fetch: mockFetch,
      poll: { initialDelayMs: 10, maxDelayMs: 100, totalTimeoutMs: 5_000 },
    });

    await vi.runAllTimersAsync();
    await promise;

    expect(client.get).toHaveBeenCalledTimes(3);
    expect(client.get).toHaveBeenCalledWith("/stat-reports/99");
  });

  it("uses exponential backoff: delays double on each retry", async () => {
    const tsv = "h\nv\n";
    const gzBuffer = makeGzBuffer(tsv);

    // Capture the sequence of timer durations via fake timers
    // vi.useFakeTimers() intercepts setTimeout; we record advances via advanceTimersByTimeAsync
    const timerAdvances: number[] = [];

    const client = makeMockClient(
      { reportJobId: 7, status: "REGIST" },
      [
        { reportJobId: 7, status: "REGIST" },
        { reportJobId: 7, status: "RUNNING" },
        { reportJobId: 7, status: "BUILT", downloadUrl: "https://example.com/dl" },
      ],
    );
    const mockFetch = makeMockFetch(gzBuffer);

    const promise = requestStatReport({
      client,
      reportTp: "AD",
      statDt: "20260501",
      fetch: mockFetch,
      poll: { initialDelayMs: 100, maxDelayMs: 10_000, totalTimeoutMs: 60_000 },
    });

    // Advance in steps: each step unblocks one poll iteration
    // After 1st GET (REGIST) → sleep 100ms
    await vi.advanceTimersByTimeAsync(100);
    timerAdvances.push(100);
    // After 2nd GET (RUNNING) → sleep 200ms (doubled)
    await vi.advanceTimersByTimeAsync(200);
    timerAdvances.push(200);
    // 3rd GET returns BUILT, no more sleep
    await vi.runAllTimersAsync();

    await promise;

    // 3 GET calls = 2 waits
    expect(client.get).toHaveBeenCalledTimes(3);
    // Verify backoff doubling: first delay 100, second 200
    expect(timerAdvances[0]).toBe(100);
    expect(timerAdvances[1]).toBe(200);
  });

  it("downloads downloadUrl, gunzips and parses TSV into rows", async () => {
    const tsv = "header1\theader2\nval1\tval2\n";
    const gzBuffer = makeGzBuffer(tsv);
    const client = makeMockClient(
      { reportJobId: 1, status: "REGIST" },
      [{ reportJobId: 1, status: "BUILT", downloadUrl: "https://cdn.example.com/file.gz" }],
    );
    const mockFetch = makeMockFetch(gzBuffer);

    const promise = requestStatReport({
      client,
      reportTp: "AD_DETAIL",
      statDt: "20260501",
      fetch: mockFetch,
      poll: { initialDelayMs: 10, maxDelayMs: 100, totalTimeoutMs: 5_000 },
    });

    await vi.runAllTimersAsync();
    const result = await promise;

    expect(mockFetch).toHaveBeenCalledWith("https://cdn.example.com/file.gz");
    expect(result.rows).toHaveLength(1);
    expect(result.rows[0]).toEqual({ header1: "val1", header2: "val2" });
  });

  it("parses Korean TSV correctly through the full flow", async () => {
    const tsv = "키워드\t노출수\t클릭수\n광고\t100\t10\n";
    const gzBuffer = makeGzBuffer(tsv);
    const client = makeMockClient(
      { reportJobId: 55, status: "REGIST" },
      [{ reportJobId: 55, status: "BUILT", downloadUrl: "https://example.com/dl.gz" }],
    );
    const mockFetch = makeMockFetch(gzBuffer);

    const promise = requestStatReport({
      client,
      reportTp: "EXPKEYWORD",
      statDt: "20260501",
      fetch: mockFetch,
      poll: { initialDelayMs: 10, maxDelayMs: 100, totalTimeoutMs: 5_000 },
    });

    await vi.runAllTimersAsync();
    const result = await promise;

    expect(result.rows).toHaveLength(1);
    expect(result.rows[0]).toEqual({ 키워드: "광고", 노출수: "100", 클릭수: "10" });
  });

  it("throws StatReportTimeoutError when polling exceeds totalTimeoutMs", async () => {
    // All GET calls return RUNNING so it never finishes.
    // We set the system time to expire the timeout after the first sleep.
    const runningResponse = { reportJobId: 123, status: "RUNNING" };
    const client = makeMockClient(
      { reportJobId: 123, status: "REGIST" },
      Array(100).fill(runningResponse),
    );
    const mockFetch = vi.fn();

    const startTime = Date.now();
    vi.setSystemTime(startTime);

    const promise = requestStatReport({
      client,
      reportTp: "AD_DETAIL",
      statDt: "20260501",
      fetch: mockFetch,
      // timeout of 50ms; initialDelay 10ms
      poll: { initialDelayMs: 10, maxDelayMs: 20, totalTimeoutMs: 50 },
    });

    // Advance fake time past the totalTimeoutMs so Date.now() reflects expiry
    vi.setSystemTime(startTime + 100);
    // Advance timer to fire the pending sleep(10ms)
    await vi.advanceTimersByTimeAsync(100);

    await expect(promise).rejects.toBeInstanceOf(StatReportTimeoutError);
  });

  it("throws StatReportFailedError when status=FAILED", async () => {
    const client = makeMockClient(
      { reportJobId: 77, status: "REGIST" },
      [{ reportJobId: 77, status: "FAILED" }],
    );
    const mockFetch = vi.fn();

    // FAILED is detected immediately after the first GET poll (no sleep needed)
    const promise = requestStatReport({
      client,
      reportTp: "AD_CONVERSION",
      statDt: "20260501",
      fetch: mockFetch,
      poll: { initialDelayMs: 10, maxDelayMs: 100, totalTimeoutMs: 5_000 },
    });

    await expect(promise).rejects.toBeInstanceOf(StatReportFailedError);
  });

  it("throws StatReportFailedError when status=NONE", async () => {
    const client = makeMockClient(
      { reportJobId: 88, status: "REGIST" },
      [{ reportJobId: 88, status: "NONE" }],
    );
    const mockFetch = vi.fn();

    // NONE is detected immediately after the first GET poll (no sleep needed)
    const promise = requestStatReport({
      client,
      reportTp: "AD_CONVERSION_DETAIL",
      statDt: "20260501",
      fetch: mockFetch,
      poll: { initialDelayMs: 10, maxDelayMs: 100, totalTimeoutMs: 5_000 },
    });

    await expect(promise).rejects.toBeInstanceOf(StatReportFailedError);
  });
});
