import { gunzipSync } from "node:zlib";
import { setTimeout as sleep } from "node:timers/promises";
import type { INaverAdsClient } from "./types.js";

export const REPORT_TYPES = [
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
] as const;
export type ReportType = (typeof REPORT_TYPES)[number];

export interface StatReportRequest {
  client: INaverAdsClient;
  reportTp: ReportType;
  statDt: string; // "YYYYMMDD"
  /** Polling config (exposed for tests) */
  poll?: {
    initialDelayMs?: number;
    maxDelayMs?: number;
    totalTimeoutMs?: number;
  };
}

export interface StatReportResult<TRow = Record<string, string>> {
  rows: TRow[];
  reportTp: ReportType;
  statDt: string;
  reportJobId: number;
}

export class StatReportTimeoutError extends Error {
  constructor(reportJobId: number, elapsedMs: number) {
    super(
      `StatReport polling timed out for jobId=${reportJobId} after ${elapsedMs}ms`,
    );
    this.name = "StatReportTimeoutError";
  }
}

export class StatReportFailedError extends Error {
  constructor(reportJobId: number, status: string) {
    super(`StatReport job ${reportJobId} failed with status=${status}`);
    this.name = "StatReportFailedError";
  }
}

interface StatReportJobResponse {
  reportJobId: number;
  status: "REGIST" | "RUNNING" | "BUILT" | "FAILED" | "NONE" | string;
  downloadUrl?: string;
}

const DEFAULT_POLL = {
  initialDelayMs: 1_000,
  maxDelayMs: 30_000,
  totalTimeoutMs: 600_000,
};

async function pollUntilBuilt(
  client: INaverAdsClient,
  reportJobId: number,
  poll: Required<NonNullable<StatReportRequest["poll"]>>,
): Promise<string> {
  const startTime = Date.now();
  let delay = poll.initialDelayMs;

  while (true) {
    const elapsed = Date.now() - startTime;
    if (elapsed >= poll.totalTimeoutMs) {
      throw new StatReportTimeoutError(reportJobId, elapsed);
    }

    const job = await client.get<StatReportJobResponse>(
      `/stat-reports/${reportJobId}`,
    );

    if (job.status === "BUILT") {
      if (!job.downloadUrl) {
        throw new StatReportFailedError(reportJobId, "BUILT_NO_URL");
      }
      return job.downloadUrl;
    }

    if (job.status === "FAILED" || job.status === "NONE") {
      throw new StatReportFailedError(reportJobId, job.status);
    }

    // REGIST or RUNNING — wait then retry
    await sleep(delay);
    delay = Math.min(delay * 2, poll.maxDelayMs);
  }
}

export async function requestStatReport<TRow = Record<string, string>>(
  req: StatReportRequest,
): Promise<StatReportResult<TRow>> {
  const { client, reportTp, statDt } = req;
  const poll: Required<NonNullable<StatReportRequest["poll"]>> = {
    initialDelayMs: req.poll?.initialDelayMs ?? DEFAULT_POLL.initialDelayMs,
    maxDelayMs: req.poll?.maxDelayMs ?? DEFAULT_POLL.maxDelayMs,
    totalTimeoutMs: req.poll?.totalTimeoutMs ?? DEFAULT_POLL.totalTimeoutMs,
  };

  // Step 1: POST /stat-reports to create the report job
  const job = await client.post<StatReportJobResponse>("/stat-reports", {
    reportTp,
    statDt,
  });
  const reportJobId = job.reportJobId;

  // Step 2: Poll GET /stat-reports/{reportJobId} until BUILT
  const downloadUrl = await pollUntilBuilt(client, reportJobId, poll);

  // Step 3: Signed download → branch on gzip magic bytes (1f 8b). The
  // fileVersion=v2 endpoint returns plain TSV; v1 may return gzip.
  const buf = await client.downloadBinary(downloadUrl);
  const isGzip = buf.length >= 2 && buf[0] === 0x1f && buf[1] === 0x8b;
  const tsvText = (isGzip ? gunzipSync(buf) : buf).toString("utf-8");
  const rows = parseTsv<TRow>(tsvText);

  return { rows, reportTp, statDt, reportJobId };
}

export function parseTsv<TRow = Record<string, string>>(text: string): TRow[] {
  const lines = text.split("\n");

  // Find non-empty lines
  const nonEmpty = lines.filter((line) => line.trim() !== "");
  if (nonEmpty.length === 0) return [];

  const headers = nonEmpty[0]!.split("\t").map((h) => h.trim());
  const rows: TRow[] = [];

  for (let i = 1; i < nonEmpty.length; i++) {
    const cells = nonEmpty[i]!.split("\t");
    const row: Record<string, string> = {};
    for (let j = 0; j < headers.length; j++) {
      row[headers[j]!] = cells[j] ?? "";
    }
    rows.push(row as TRow);
  }

  return rows;
}
