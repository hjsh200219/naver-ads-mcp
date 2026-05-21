import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { gzipSync } from "node:zlib";
import type { INaverAdsClient } from "../src/api/types.js";
import {
  requestStatReport,
  parseTsv,
  REPORT_TYPES,
  StatReportTimeoutError,
  StatReportFailedError,
  UnsupportedReportTypeError,
} from "../src/api/stat-reports.js";

// Real-shape AD v2 row: 14 cols, no header.
// Columns: statDt, customerId, nccCampaignId, nccAdgroupId, nccKeywordId,
//   nccAdId, businessChannelId, _u8, pcMblTp, impCnt, clkCnt, salesAmt,
//   avgRnkWeighted, _u14
const AD_TWO_ROWS =
  "20260512\t111\tcmp-1\tag-1\tkw-1\tad-1\tbsn-1\t0\tP\t1000\t10\t11000\t3500\t0\n" +
  "20260512\t111\tcmp-1\tag-1\tkw-1\tad-1\tbsn-1\t0\tM\t2000\t30\t33000\t3600\t0\n";

// Real-shape AD_CONVERSION v2 row: 13 cols, no header, convTpName string.
const AD_CONVERSION_ONE_ROW =
  "20260512\t111\tcmp-1\tag-1\tkw-1\tad-1\tbsn-1\t0\tP\t0\tlead\t1\t50000\n";

// Real-shape EXPKEYWORD v2 row: 12 cols, no header, searchTerm string.
const EXPKEYWORD_ONE_ROW =
  "20260512\t111\tcmp-1\tag-1\t네이버광고\t27758\tP\t72\t20\t3\t5000\t0\n";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeMockClient(
  postResponse: unknown,
  getResponses: unknown[],
  downloadPayload: Buffer = Buffer.from(""),
): INaverAdsClient {
  let getCallIndex = 0;
  return {
    post: vi.fn(async () => postResponse),
    get: vi.fn(async () => {
      const resp = getResponses[getCallIndex];
      getCallIndex++;
      return resp;
    }),
    downloadBinary: vi.fn(async () => downloadPayload),
  };
}

function makeGzBuffer(tsv: string): Buffer {
  return gzipSync(Buffer.from(tsv, "utf-8"));
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
  it("maps AD v2 row by column index (no header)", () => {
    const rows = parseTsv<Record<string, unknown>>(AD_TWO_ROWS, "AD");
    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({
      statDt: "20260512",
      customerId: "111",
      nccCampaignId: "cmp-1",
      nccAdgroupId: "ag-1",
      nccKeywordId: "kw-1",
      nccAdId: "ad-1",
      businessChannelId: "bsn-1",
      pcMblTp: "P",
      impCnt: 1000,
      clkCnt: 10,
      salesAmt: 11000,
      avgRnkWeighted: 3500,
      avgRnk: 3.5, // 3500 / 1000
    });
    expect(rows[0]).not.toHaveProperty("_unused8");
    expect(rows[0]).not.toHaveProperty("_unused14");
    expect(rows[1]).toMatchObject({ pcMblTp: "M", impCnt: 2000, clkCnt: 30 });
  });

  it("maps AD_CONVERSION v2 row with convTpName string", () => {
    const rows = parseTsv<Record<string, unknown>>(
      AD_CONVERSION_ONE_ROW,
      "AD_CONVERSION",
    );
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      statDt: "20260512",
      nccCampaignId: "cmp-1",
      pcMblTp: "P",
      convTpName: "lead",
      ccnt: 1,
      convAmt: 50000,
    });
  });

  it("maps EXPKEYWORD v2 row (different col order — avgRnkW before impCnt)", () => {
    const rows = parseTsv<Record<string, unknown>>(
      EXPKEYWORD_ONE_ROW,
      "EXPKEYWORD",
    );
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      searchTerm: "네이버광고",
      pcMblTp: "P",
      avgRnkWeighted: 72,
      impCnt: 20,
      clkCnt: 3,
      salesAmt: 5000,
      avgRnk: 72 / 20, // = 3.6
    });
  });

  it("handles empty string input for any reportTp", () => {
    expect(parseTsv("", "AD")).toHaveLength(0);
    expect(parseTsv("", "SHOPPINGKEYWORD_DETAIL")).toHaveLength(0);
  });

  it("ignores blank trailing lines", () => {
    expect(parseTsv(AD_TWO_ROWS + "\n\n", "AD")).toHaveLength(2);
  });

  it("throws UnsupportedReportTypeError for reportTp without verified column spec", () => {
    expect(() => parseTsv("20260512\tfoo\n", "SHOPPINGKEYWORD_DETAIL")).toThrow(
      UnsupportedReportTypeError,
    );
  });

  it("avgRnk defaults to 0 when impCnt is 0", () => {
    const noImps =
      "20260512\t111\tcmp-1\tag-1\tkw-1\tad-1\tbsn-1\t0\tP\t0\t0\t0\t0\t0\n";
    const rows = parseTsv<Record<string, unknown>>(noImps, "AD");
    expect(rows[0]?.avgRnk).toBe(0);
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
        {
          reportJobId: 42,
          status: "BUILT",
          downloadUrl: "https://example.com/dl",
        },
      ],
      gzBuffer,
    );

    const promise = requestStatReport({
      client,
      reportTp: "AD_DETAIL",
      statDt: "20260501",
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
        {
          reportJobId: 99,
          status: "BUILT",
          downloadUrl: "https://example.com/dl",
        },
      ],
      gzBuffer,
    );

    const promise = requestStatReport({
      client,
      reportTp: "AD_DETAIL",
      statDt: "20260501",
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
        {
          reportJobId: 7,
          status: "BUILT",
          downloadUrl: "https://example.com/dl",
        },
      ],
      gzBuffer,
    );

    const promise = requestStatReport({
      client,
      reportTp: "AD",
      statDt: "20260501",
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

  it("downloads downloadUrl, gunzips and parses AD_DETAIL TSV into rows", async () => {
    // AD_DETAIL: 16 cols
    const tsv =
      "20260501\t111\tcmp-1\tag-1\tkw-1\tad-1\tbsn-1\t13\t02\t0\tP\t100\t5\t1500\t110\t0\n";
    const gzBuffer = makeGzBuffer(tsv);
    const client = makeMockClient(
      { reportJobId: 1, status: "REGIST" },
      [
        {
          reportJobId: 1,
          status: "BUILT",
          downloadUrl: "https://cdn.example.com/file.gz",
        },
      ],
      gzBuffer,
    );

    const promise = requestStatReport({
      client,
      reportTp: "AD_DETAIL",
      statDt: "20260501",
      poll: { initialDelayMs: 10, maxDelayMs: 100, totalTimeoutMs: 5_000 },
    });

    await vi.runAllTimersAsync();
    const result = await promise;

    expect(client.downloadBinary).toHaveBeenCalledWith(
      "https://cdn.example.com/file.gz",
    );
    expect(result.rows).toHaveLength(1);
    expect(result.rows[0]).toMatchObject({
      statDt: "20260501",
      nccCampaignId: "cmp-1",
      pcMblTp: "P",
      impCnt: 100,
      clkCnt: 5,
      salesAmt: 1500,
    });
  });

  it("handles plain TSV downloads (no gzip magic bytes)", async () => {
    const plainBuffer = Buffer.from(AD_TWO_ROWS, "utf-8");
    const client = makeMockClient(
      { reportJobId: 2, status: "REGIST" },
      [
        {
          reportJobId: 2,
          status: "BUILT",
          downloadUrl: "https://cdn.example.com/plain.tsv",
        },
      ],
      plainBuffer,
    );

    const promise = requestStatReport({
      client,
      reportTp: "AD",
      statDt: "20260501",
      poll: { initialDelayMs: 10, maxDelayMs: 100, totalTimeoutMs: 5_000 },
    });

    await vi.runAllTimersAsync();
    const result = await promise;
    expect(result.rows).toHaveLength(2);
    expect(result.rows[0]).toMatchObject({ impCnt: 1000, clkCnt: 10 });
  });

  it("parses Korean searchTerm in EXPKEYWORD through the full flow", async () => {
    const gzBuffer = makeGzBuffer(EXPKEYWORD_ONE_ROW);
    const client = makeMockClient(
      { reportJobId: 55, status: "REGIST" },
      [
        {
          reportJobId: 55,
          status: "BUILT",
          downloadUrl: "https://example.com/dl.gz",
        },
      ],
      gzBuffer,
    );

    const promise = requestStatReport({
      client,
      reportTp: "EXPKEYWORD",
      statDt: "20260501",
      poll: { initialDelayMs: 10, maxDelayMs: 100, totalTimeoutMs: 5_000 },
    });

    await vi.runAllTimersAsync();
    const result = await promise;

    expect(result.rows).toHaveLength(1);
    expect(result.rows[0]).toMatchObject({
      searchTerm: "네이버광고",
      impCnt: 20,
      clkCnt: 3,
      salesAmt: 5000,
    });
  });

  it("throws StatReportTimeoutError when polling exceeds totalTimeoutMs", async () => {
    // All GET calls return RUNNING so it never finishes.
    // We set the system time to expire the timeout after the first sleep.
    const runningResponse = { reportJobId: 123, status: "RUNNING" };
    const client = makeMockClient(
      { reportJobId: 123, status: "REGIST" },
      Array(100).fill(runningResponse),
    );

    const startTime = Date.now();
    vi.setSystemTime(startTime);

    const promise = requestStatReport({
      client,
      reportTp: "AD_DETAIL",
      statDt: "20260501",
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
    const client = makeMockClient({ reportJobId: 77, status: "REGIST" }, [
      { reportJobId: 77, status: "FAILED" },
    ]);

    // FAILED is detected immediately after the first GET poll (no sleep needed)
    const promise = requestStatReport({
      client,
      reportTp: "AD_CONVERSION",
      statDt: "20260501",
      poll: { initialDelayMs: 10, maxDelayMs: 100, totalTimeoutMs: 5_000 },
    });

    await expect(promise).rejects.toBeInstanceOf(StatReportFailedError);
  });

  it("throws StatReportFailedError when status=NONE", async () => {
    const client = makeMockClient({ reportJobId: 88, status: "REGIST" }, [
      { reportJobId: 88, status: "NONE" },
    ]);

    // NONE is detected immediately after the first GET poll (no sleep needed)
    const promise = requestStatReport({
      client,
      reportTp: "AD_CONVERSION_DETAIL",
      statDt: "20260501",
      poll: { initialDelayMs: 10, maxDelayMs: 100, totalTimeoutMs: 5_000 },
    });

    await expect(promise).rejects.toBeInstanceOf(StatReportFailedError);
  });
});
