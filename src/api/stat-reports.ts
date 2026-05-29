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

export interface StatReportResult<TRow = Record<string, unknown>> {
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

export class UnsupportedReportTypeError extends Error {
  constructor(reportTp: string) {
    super(
      `parseTsv: column spec not yet verified for reportTp=${reportTp}. ` +
        `Verify against /stats and add a column map in COLUMN_MAPS before use.`,
    );
    this.name = "UnsupportedReportTypeError";
  }
}

interface StatReportJobResponse {
  reportJobId: number;
  status: "REGIST" | "RUNNING" | "BUILT" | "FAILED" | "NONE" | string;
  downloadUrl?: string;
}

const DEFAULT_POLL = {
  // 250ms first poll: most stat-report jobs build in well under a second, so a
  // 1s initial wait dominated latency. Exponential backoff (×2 → 30s cap) still
  // backs off for slow large-advertiser jobs.
  initialDelayMs: 250,
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

export async function requestStatReport<TRow = Record<string, unknown>>(
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
  const rows = parseTsv<TRow>(tsvText, reportTp);

  return { rows, reportTp, statDt, reportJobId };
}

// ---------------------------------------------------------------------------
// Column specs (v2 stat-report responses are header-less raw TSV).
// Verified against the synchronous /stats API on 2026-05-21 for the
// hellomax account. See .claude-project/memory/stat-report-column-spec.md.
// ---------------------------------------------------------------------------

type ColField = string;

interface ColumnMap {
  expectedColCount: number;
  // Names per 0-indexed TSV column. "_unused" or "_unusedN" → discarded.
  fields: readonly ColField[];
}

const COLUMN_MAPS: Partial<Record<ReportType, ColumnMap>> = {
  AD: {
    expectedColCount: 14,
    fields: [
      "statDt",
      "customerId",
      "nccCampaignId",
      "nccAdgroupId",
      "nccKeywordId",
      "nccAdId",
      "businessChannelId",
      "_unused8",
      "pcMblTp",
      "impCnt",
      "clkCnt",
      "salesAmt",
      "avgRnkWeighted",
      "_unused14",
    ],
  },
  AD_DETAIL: {
    expectedColCount: 16,
    fields: [
      "statDt",
      "customerId",
      "nccCampaignId",
      "nccAdgroupId",
      "nccKeywordId",
      "nccAdId",
      "businessChannelId",
      "_unused8",
      "_unused9",
      "_unused10",
      "pcMblTp",
      "impCnt",
      "clkCnt",
      "salesAmt",
      "avgRnkWeighted",
      "_unused16",
    ],
  },
  AD_CONVERSION: {
    expectedColCount: 13,
    fields: [
      "statDt",
      "customerId",
      "nccCampaignId",
      "nccAdgroupId",
      "nccKeywordId",
      "nccAdId",
      "businessChannelId",
      "_unused8",
      "pcMblTp",
      "_unused10",
      "convTpName",
      "ccnt",
      "convAmt",
    ],
  },
  AD_CONVERSION_DETAIL: {
    expectedColCount: 15,
    fields: [
      "statDt",
      "customerId",
      "nccCampaignId",
      "nccAdgroupId",
      "nccKeywordId",
      "nccAdId",
      "businessChannelId",
      "_unused8",
      "_unused9",
      "_unused10",
      "pcMblTp",
      "_unused12",
      "convTpName",
      "ccnt",
      "convAmt",
    ],
  },
  EXPKEYWORD: {
    expectedColCount: 12,
    fields: [
      "statDt",
      "customerId",
      "nccCampaignId",
      "nccAdgroupId",
      "searchTerm",
      "_unused6",
      "pcMblTp",
      "avgRnkWeighted",
      "impCnt",
      "clkCnt",
      "salesAmt",
      "_unused12",
    ],
  },
};

// Fields whose value should be coerced to a number (Number.NaN → 0).
const NUMERIC_FIELDS = new Set<ColField>([
  "impCnt",
  "clkCnt",
  "salesAmt",
  "avgRnkWeighted",
  "ccnt",
  "convAmt",
]);

function coerce(field: ColField, raw: string): unknown {
  if (NUMERIC_FIELDS.has(field)) {
    if (raw === "") return 0;
    const n = Number(raw);
    return Number.isFinite(n) ? n : 0;
  }
  return raw;
}

export function parseTsv<TRow = Record<string, unknown>>(
  text: string,
  reportTp: ReportType,
): TRow[] {
  const lines = text.split("\n");
  const nonEmpty = lines.filter((line) => line.trim() !== "");
  // Empty body is fine for any reportTp — Naver returns "no rows" without a
  // schema. Only block unverified reportTps when they actually have data.
  if (nonEmpty.length === 0) return [];

  const spec = COLUMN_MAPS[reportTp];
  if (!spec) throw new UnsupportedReportTypeError(reportTp);

  const rows: TRow[] = [];
  for (const line of nonEmpty) {
    const cells = line.split("\t");
    const row: Record<string, unknown> = {};
    for (let j = 0; j < spec.fields.length; j++) {
      const field = spec.fields[j]!;
      if (field.startsWith("_unused")) continue;
      const raw = (cells[j] ?? "").trim();
      row[field] = coerce(field, raw);
    }
    // Derived: avgRnk = avgRnkWeighted / impCnt (0 if no impressions).
    // Builder consumes `avgRnk` directly; downstream weighted-mean code can
    // still recompute from impCnt × avgRnk if needed.
    if ("avgRnkWeighted" in row && "impCnt" in row) {
      const imp = row.impCnt as number;
      const w = row.avgRnkWeighted as number;
      row.avgRnk = imp > 0 ? w / imp : 0;
    }
    rows.push(row as TRow);
  }

  return rows;
}
