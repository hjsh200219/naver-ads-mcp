import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  ListResourcesRequestSchema,
  ReadResourceRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { McpError, ErrorCode } from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";

import type { NaverAdsCredentials } from "../config/credentials.js";
import { EnvCredentialLoader } from "../config/credentials.js";
import { NaverAdsClient, NaverAdsApiError } from "../api/client.js";
import type { INaverAdsClient } from "../api/types.js";
import {
  AccountNotFoundError,
  MapAccountStore,
  type IAccountStore,
} from "../config/account-store.js";
import {
  REPORT_TYPES,
  requestStatReport,
  StatReportFailedError,
} from "../api/stat-reports.js";
import {
  getCampaigns,
  getAdGroups,
  getAllKeywords,
  getProducts,
} from "../api/metadata.js";
import { buildDailyRaw } from "../raw/daily.js";
import { buildKeywordRaw } from "../raw/keyword.js";
import { buildSearchTermRaw } from "../raw/search-term.js";
import { buildMaterialRaw } from "../raw/material.js";
import { buildSummary } from "../pivot/summary.js";
import { buildMediaPerformance } from "../pivot/media.js";
import { buildKeywordPerformance } from "../pivot/keyword.js";
import { buildProductPerformance } from "../pivot/product.js";
import { buildSearchTermPerformance } from "../pivot/search-term.js";
import { writeReport } from "../excel/writer.js";
import { readHistory, appendHistory } from "../runtime/history.js";
import { computePayloadHash } from "../runtime/payload-hash.js";
import { writeReportFiles } from "../output/file-writer.js";
import { renderArtifactHtml } from "../dashboard/artifact-html.js";
import {
  type PrecomputedPayload,
  PrecomputedPayloadSchema,
  AiAnalysisSchema,
  type KpiSummary,
} from "../parser/types.js";
import { parseHelloMaxXlsx } from "../parser/excel-template.js";
import { aggregateWeeklyPayload } from "../parser/aggregate-payload.js";
import {
  buildSystemPrompt,
  buildUserPrompt,
  buildPayloadSummaryMd,
  EXPECTED_AI_ANALYSIS_SCHEMA,
} from "../analyzer/weekly-prompt.js";
import {
  aggregateDailyPayload,
  type DailyPayload,
} from "../parser/aggregate-daily.js";
import {
  evaluateThresholds,
  resolveThresholds,
  type ThresholdViolation,
} from "../analyzer/thresholds.js";
import os from "node:os";
import path from "node:path";
import crypto from "node:crypto";

export interface ServerDeps {
  /** Multi-account registry. If omitted, falls back to legacy env-var single-account behaviour. */
  accountStore?: IAccountStore;
  /** Backwards-compat: if no accountStore, use this loader to build a single-account store. */
  credentialLoader?: { load(): NaverAdsCredentials };
  /** Pre-built client (test path). Bypasses accountStore — used as a single shared client for ALL accounts. */
  client?: INaverAdsClient;
  /** Factory for building per-account clients. If omitted, defaults to `new NaverAdsClient(...)`. */
  clientFactory?: (cred: NaverAdsCredentials) => INaverAdsClient;
  /** Injectable for tests. */
  fetch?: typeof globalThis.fetch;
  baseUrl?: string;
  /** v1.6 Phase 0/3 — base directory for history JSONL files (defaults to ~/.naver-ads-mcp/history). */
  historyBaseDir?: string;
  /** v1.6 Phase 3 — base directory for prepared report files (defaults to ~/.naver-ads-mcp/reports). */
  reportsBaseDir?: string;
  /** v1.6 Phase 1 — provider that returns a PrecomputedPayload for (client, week). Tests inject. */
  payloadProvider?: (args: {
    client: string;
    week: string;
  }) => Promise<PrecomputedPayload>;
  /** v1.6 Phase 3.5 — provider that returns a DailyPayload for (client, date). Tests inject. */
  dailyPayloadProvider?: (args: {
    client: string;
    date: string;
  }) => Promise<DailyPayload>;
}

// ---------------------------------------------------------------------------
// Argument schemas
// ---------------------------------------------------------------------------

// Account identifier: alphanumeric + dash + underscore, max 64 chars.
// Korean/non-ASCII labels are rejected to keep names safe to log and to
// avoid platform-specific path-collision surprises in future filesystem use.
const ACCOUNT_PATTERN = "^[a-zA-Z0-9_-]{1,64}$";
const AccountSchema = z
  .string()
  .regex(new RegExp(ACCOUNT_PATTERN), "Invalid account identifier")
  .optional();

const NoArgsSchema = z.object({ account: AccountSchema }).strict();

const FetchRawDataSchema = z.object({
  account: AccountSchema,
  reportTp: z.enum(REPORT_TYPES),
  startDate: z.string().regex(/^\d{8}$/),
  endDate: z.string().regex(/^\d{8}$/),
  /** When set, write all rows as JSON to this absolute path and return only path + count. Avoids the MCP 1MB result limit. */
  outputPath: z.string().optional(),
  /** When true, omit row payload and return only count + per-date summary. */
  summarize: z.boolean().optional(),
  /** Cap number of rows in the response (ignored when outputPath is set). Default: no cap. */
  limit: z.number().int().positive().optional(),
});

const GenerateReportSchema = z.object({
  account: AccountSchema,
  startDate: z.string().regex(/^\d{8}$/),
  endDate: z.string().regex(/^\d{8}$/),
  outputPath: z.string(),
});

const ClientIdPattern = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const WeekPattern = /^\d{4}-W\d{2}$/;
const WeeklyLabelPattern = /^\d{4}-\d{2}-\d{2}주차$/;
const DatePattern = /^\d{4}-\d{2}-\d{2}$/;

const PrepareDailySchema = z
  .object({
    date: z.string().regex(DatePattern),
  })
  .strict();

const PrepareWeeklyPayloadSchema = z
  .object({
    account: AccountSchema,
    client: z.string().regex(ClientIdPattern),
    week: z.string().regex(WeekPattern),
    /** Path to the AE-uploaded helloMAX form xlsx. Required when no payloadProvider is injected. */
    xlsxPath: z.string().optional(),
    /** 일별RAW 주차 label for the current week (e.g. "2026-05-04주차"). Used with xlsxPath. */
    targetWeekLabel: z.string().regex(WeeklyLabelPattern).optional(),
    /** 일별RAW 주차 label for the comparison week. */
    compareWeekLabel: z.string().regex(WeeklyLabelPattern).optional(),
  })
  .strict();

const GenerateWeeklyPromptSchema = z
  .object({
    payload: PrecomputedPayloadSchema,
  })
  .strict();

const FinalizeWeeklySchema = z
  .object({
    account: AccountSchema,
    client: z.string().regex(ClientIdPattern),
    week: z.string().regex(WeekPattern),
    payload: PrecomputedPayloadSchema,
    ai_analysis: AiAnalysisSchema,
    correction: z.boolean().optional(),
  })
  .strict();

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function enumerateDates(startDate: string, endDate: string): string[] {
  const toUtcMs = (s: string) =>
    Date.UTC(
      Number(s.slice(0, 4)),
      Number(s.slice(4, 6)) - 1,
      Number(s.slice(6, 8)),
    );
  const dates: string[] = [];
  for (
    let cursor = toUtcMs(startDate), endMs = toUtcMs(endDate);
    cursor <= endMs;
    cursor += 86_400_000
  ) {
    const d = new Date(cursor);
    const yyyy = String(d.getUTCFullYear());
    const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
    const dd = String(d.getUTCDate()).padStart(2, "0");
    dates.push(`${yyyy}${mm}${dd}`);
  }
  return dates;
}

function toContentText(obj: unknown): { type: "text"; text: string }[] {
  return [{ type: "text", text: JSON.stringify(obj) }];
}

async function readAllHistoryWeeks(
  baseDir: string,
  clientId: string,
): Promise<unknown[]> {
  const fsp = (await import("node:fs")).promises;
  const dir = path.join(baseDir, clientId);
  let names: string[];
  try {
    names = await fsp.readdir(dir);
  } catch (err) {
    if (
      err instanceof Error &&
      (err as NodeJS.ErrnoException).code === "ENOENT"
    ) {
      return [];
    }
    throw err;
  }
  const weeks = names
    .filter((n) => /^(\d{4}-W\d{2}|\d{4}-\d{2}-\d{2})\.jsonl$/.test(n))
    .map((n) => n.replace(/\.jsonl$/, ""))
    .sort();
  const out: unknown[] = [];
  for (const week of weeks) {
    const entries = await readHistory({ baseDir, client: clientId, week });
    for (const e of entries) out.push(e);
  }
  return out;
}

const YYYYMMDD = { type: "string" as const, pattern: "^\\d{8}$" };
const ACCOUNT_SCHEMA_FRAG = {
  type: "string" as const,
  pattern: ACCOUNT_PATTERN,
  description:
    "Account identifier (defaults to the configured default account)",
};

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

export function createServer(deps: ServerDeps = {}): {
  server: Server;
  tools: {
    validate_credentials: (args?: { account?: string }) => Promise<unknown>;
    list_report_types: () => unknown;
    list_accounts: () => unknown;
    fetch_raw_data: (
      args: z.infer<typeof FetchRawDataSchema>,
    ) => Promise<unknown>;
    generate_report: (
      args: z.infer<typeof GenerateReportSchema>,
    ) => Promise<unknown>;
    prepare_weekly_payload: (
      args: z.infer<typeof PrepareWeeklyPayloadSchema>,
    ) => Promise<unknown>;
    generate_weekly_analysis_prompt: (
      args: z.infer<typeof GenerateWeeklyPromptSchema>,
    ) => Promise<unknown>;
    finalize_weekly_dashboard: (
      args: z.infer<typeof FinalizeWeeklySchema>,
    ) => Promise<unknown>;
    prepare_daily_dashboard: (
      args: z.infer<typeof PrepareDailySchema>,
    ) => Promise<unknown>;
  };
} {
  const BASE_URL = deps.baseUrl ?? "https://api.searchad.naver.com";

  // Resolve account store lazily — env-only mode only fails when a tool is called.
  let _store: IAccountStore | undefined = deps.accountStore;
  function getStore(): IAccountStore {
    if (_store) return _store;
    const loader = deps.credentialLoader ?? new EnvCredentialLoader();
    const cred = loader.load();
    const accounts = new Map<string, NaverAdsCredentials>();
    accounts.set("default", cred);
    _store = new MapAccountStore({ accounts, defaultName: "default" });
    return _store;
  }

  const factory =
    deps.clientFactory ??
    ((cred: NaverAdsCredentials) =>
      new NaverAdsClient({
        baseUrl: BASE_URL,
        credentials: cred,
        fetch: deps.fetch,
      }));

  const clientCache = new Map<string, INaverAdsClient>();

  function resolveClient(accountName?: string): INaverAdsClient {
    // When an explicit `accountStore` is provided, validate the account name
    // through the store first so unknown names fail before any request runs
    // (even on the test path that supplies a fixed `client` override).
    if (deps.accountStore !== undefined) {
      const cred = deps.accountStore.get(accountName);
      if (deps.client) return deps.client;
      return cachedClient(cred);
    }
    // No store passed: tests may inject a `client` override directly without
    // any credentials at all (mcp.test.ts). Fall back to the legacy lazy path.
    if (deps.client) return deps.client;
    const cred = getStore().get(accountName);
    return cachedClient(cred);
  }

  function cachedClient(cred: NaverAdsCredentials): INaverAdsClient {
    // Cache key = credential's customerId. Collapses `account: undefined` and
    // `account: <default-name>` into a single entry instead of building two
    // clients for the same credential.
    const key = cred.customerId;
    let client = clientCache.get(key);
    if (client === undefined) {
      client = factory(cred);
      clientCache.set(key, client);
    }
    return client;
  }

  // ---------------------------------------------------------------------------
  // Tool implementations
  // ---------------------------------------------------------------------------

  const tool_validate_credentials = async (args: { account?: string } = {}) => {
    try {
      // Validate account name shape before resolving (regex-fail returns generic).
      const parsed = NoArgsSchema.safeParse(args);
      if (!parsed.success) {
        return { ok: false, error: "Invalid account identifier" };
      }
      const client = resolveClient(parsed.data.account);
      await client.get("/billing/bizmoney");
      return { ok: true, message: "Credentials are valid" };
    } catch (err) {
      if (err instanceof AccountNotFoundError) {
        return { ok: false, error: "Account not found" };
      }
      if (err instanceof NaverAdsApiError) {
        if (err.status === 401 || err.status === 403) {
          return { ok: false, error: `Authentication failed (${err.status})` };
        }
        if (err.status >= 500) {
          return { ok: false, error: `Server unavailable (${err.status})` };
        }
        return { ok: false, error: `Request failed (${err.status})` };
      }
      return { ok: false, error: "Network or unknown error" };
    }
  };

  const tool_list_report_types = () => ({
    reportTypes: [
      {
        name: "AD",
        description: "광고효과보고서 (캠페인/광고그룹/디바이스 단위 운영성과)",
        retentionDays: 365,
      },
      {
        name: "AD_DETAIL",
        description: "광고효과 상세 (키워드 단위)",
        retentionDays: 180,
      },
      {
        name: "AD_CONVERSION",
        description: "광고전환보고서",
        retentionDays: 365,
      },
      {
        name: "AD_CONVERSION_DETAIL",
        description: "키워드 단위 전환",
        retentionDays: 45,
      },
      {
        name: "EXPKEYWORD",
        description: "파워링크 검색어 보고서",
        retentionDays: 365,
      },
      {
        name: "SHOPPINGKEYWORD_DETAIL",
        description: "쇼핑검색 키워드 상세",
        retentionDays: 180,
      },
      {
        name: "SHOPPINGKEYWORD_CONVERSION_DETAIL",
        description: "쇼핑검색 키워드 전환 상세",
        retentionDays: 45,
      },
      {
        name: "SHOPPINGBRANDPRODUCT",
        description: "쇼핑 브랜드 상품 보고서",
        retentionDays: 365,
      },
      {
        name: "SHOPPINGBRANDPRODUCT_CONVERSION",
        description: "쇼핑 브랜드 상품 전환",
        retentionDays: 365,
      },
      {
        name: "BRND_CONTRACT",
        description: "브랜드검색 계약 단위 (영역별 미제공)",
        retentionDays: 120,
      },
    ],
  });

  const tool_list_accounts = () => {
    const store = getStore();
    return {
      accounts: store.list(),
      default: store.default() ?? null,
    };
  };

  const tool_fetch_raw_data = async (
    args: z.infer<typeof FetchRawDataSchema>,
  ) => {
    const {
      reportTp,
      startDate,
      endDate,
      account,
      outputPath,
      summarize,
      limit,
    } = args;
    const client = resolveClient(account);
    const dates = enumerateDates(startDate, endDate);
    const allRows: Record<string, unknown>[] = [];
    const perDate: { date: string; count: number }[] = [];
    for (const statDt of dates) {
      const result = await requestStatReport({
        client,
        reportTp,
        statDt,
      });
      allRows.push(...result.rows);
      perDate.push({ date: statDt, count: result.rows.length });
    }

    const base = { count: allRows.length, reportTp, startDate, endDate };

    if (outputPath) {
      const fsp = (await import("node:fs")).promises;
      const pathMod = await import("node:path");
      await fsp.mkdir(pathMod.dirname(outputPath), { recursive: true });
      await fsp.writeFile(
        outputPath,
        JSON.stringify({ ...base, perDate, rows: allRows }, null, 2),
        "utf8",
      );
      return { ...base, perDate, outputPath };
    }

    if (summarize) {
      return { ...base, perDate };
    }

    const RESPONSE_LIMIT_BYTES = 900_000; // safety margin under 1MB
    const truncatedRows = limit ? allRows.slice(0, limit) : allRows;
    const candidate = {
      ...base,
      perDate,
      rows: truncatedRows,
      ...(limit && allRows.length > limit ? { truncated: true } : {}),
    };
    const size = Buffer.byteLength(JSON.stringify(candidate), "utf8");
    if (size <= RESPONSE_LIMIT_BYTES) {
      return candidate;
    }
    return {
      ...base,
      perDate,
      hint: `Result ${size} bytes exceeds the MCP 1MB response limit. Re-call with outputPath:"<abs-path>.json" to persist all rows, or summarize:true to skip rows, or limit:<N> to cap the row count.`,
    };
  };

  const tool_generate_report = async (
    args: z.infer<typeof GenerateReportSchema>,
  ) => {
    const { startDate, endDate, outputPath, account } = args;
    const client = resolveClient(account);
    const dates = enumerateDates(startDate, endDate);

    const [campaigns, adGroups, products] = await Promise.all([
      getCampaigns(client),
      getAdGroups(client),
      getProducts(client),
    ]);
    const keywords = await getAllKeywords(client, adGroups);

    const fetchAll = async (
      reportTp: (typeof REPORT_TYPES)[number],
    ): Promise<Record<string, unknown>[]> => {
      const rows: Record<string, unknown>[] = [];
      for (const statDt of dates) {
        try {
          const result = await requestStatReport({
            client,
            reportTp,
            statDt,
          });
          rows.push(...result.rows);
        } catch (err) {
          // Tolerate only Naver's explicit "no data" / "failed" signals for a
          // single statDt — continue with remaining dates. Network / auth /
          // 5xx errors propagate so callers see real failures instead of
          // silently empty rows.
          if (err instanceof StatReportFailedError) {
            continue;
          }
          throw err;
        }
      }
      return rows;
    };

    const [
      adRows,
      adConvRows,
      adDetailRows,
      adConvDetailRows,
      expkwRows,
      shopBrandRows,
      shopBrandConvRows,
    ] = await Promise.all([
      fetchAll("AD"),
      fetchAll("AD_CONVERSION"),
      fetchAll("AD_DETAIL"),
      fetchAll("AD_CONVERSION_DETAIL"),
      fetchAll("EXPKEYWORD"),
      fetchAll("SHOPPINGBRANDPRODUCT"),
      fetchAll("SHOPPINGBRANDPRODUCT_CONVERSION"),
    ]);

    const rawDaily = await buildDailyRaw({
      startDate,
      endDate,
      fetched: { op: adRows, conv: adConvRows, campaigns, adGroups },
    });
    const rawKeyword = await buildKeywordRaw({
      startDate,
      endDate,
      fetched: {
        op: adDetailRows,
        conv: adConvDetailRows,
        campaigns,
        adGroups,
        keywords,
      },
    });
    const rawSearchTerm = await buildSearchTermRaw({
      startDate,
      endDate,
      fetched: { op: expkwRows, conv: [], campaigns, adGroups },
    });
    const rawMaterial = await buildMaterialRaw({
      startDate,
      endDate,
      fetched: {
        op: shopBrandRows,
        conv: shopBrandConvRows,
        campaigns,
        adGroups,
        products,
      },
    });

    const allDaily = [...rawDaily, ...rawKeyword];
    const pivotSummary = buildSummary(allDaily);
    const pivotMedia = buildMediaPerformance(allDaily);
    const pivotKeyword = buildKeywordPerformance(rawKeyword);
    const pivotProduct = buildProductPerformance(rawMaterial);
    const pivotSearchTerm = buildSearchTermPerformance(rawSearchTerm);

    return await writeReport({
      outputPath,
      data: {
        rawDaily,
        rawKeyword,
        rawSearchTerm,
        rawMaterial,
        pivotSummary,
        pivotMedia,
        pivotKeyword,
        pivotProduct,
        pivotSearchTerm,
      },
    });
  };

  const REPORTS_BASE_DIR =
    deps.reportsBaseDir ?? path.join(os.homedir(), ".naver-ads-mcp", "reports");

  const HISTORY_BASE_DIR =
    deps.historyBaseDir ?? path.join(os.homedir(), ".naver-ads-mcp", "history");

  const tool_prepare_weekly_payload = async (
    args: z.infer<typeof PrepareWeeklyPayloadSchema>,
  ): Promise<unknown> => {
    const { client: clientId, week } = args;
    let payload: PrecomputedPayload;
    if (deps.payloadProvider) {
      payload = await deps.payloadProvider({ client: clientId, week });
    } else if (args.xlsxPath && args.targetWeekLabel && args.compareWeekLabel) {
      const rows = await parseHelloMaxXlsx(args.xlsxPath);
      payload = aggregateWeeklyPayload({
        advertiser: clientId,
        rows,
        targetWeek: args.targetWeekLabel,
        compareWeek: args.compareWeekLabel,
      });
    } else {
      throw new Error(
        "prepare_weekly_payload: either a payloadProvider must be configured, or args must include xlsxPath + targetWeekLabel + compareWeekLabel.",
      );
    }
    return {
      payload,
      payload_summary_md: buildPayloadSummaryMd(payload),
    };
  };

  const tool_generate_weekly_analysis_prompt = async (
    args: z.infer<typeof GenerateWeeklyPromptSchema>,
  ): Promise<unknown> => {
    return {
      system_prompt: buildSystemPrompt(),
      user_prompt: buildUserPrompt(args.payload),
      expected_schema: EXPECTED_AI_ANALYSIS_SCHEMA,
    };
  };

  const tool_finalize_weekly_dashboard = async (
    args: z.infer<typeof FinalizeWeeklySchema>,
  ): Promise<unknown> => {
    const { client: clientId, week, payload, ai_analysis: ai } = args;
    const minute = Math.floor(Date.now() / 60_000);
    const payload_hash = computePayloadHash(
      { client: clientId, week, payload, ai },
      minute,
    );
    const { html_path, xlsx_path } = await writeReportFiles({
      baseDir: REPORTS_BASE_DIR,
      client: clientId,
      week,
      payload,
      ai,
    });
    const artifact_html = renderArtifactHtml({ payload, ai });
    await appendHistory({
      baseDir: HISTORY_BASE_DIR,
      entry: {
        week,
        client: clientId,
        payload_hash,
        prepared_at: new Date().toISOString(),
        html_path,
        xlsx_path,
        status: args.correction ? "corrected_prepared" : "prepared",
      },
    });
    return {
      artifact_html,
      html_path,
      xlsx_path,
      payload_hash,
      data_warnings: [...payload.data_warnings, ...ai.data_warnings],
    };
  };

  // ---------------------------------------------------------------------------
  // prepare_daily_dashboard (US-020, Phase 3.5)
  // ---------------------------------------------------------------------------

  // Maps a client_id (mappings) → account name (accountStore) by matching
  // customer_id. Returns undefined when the mapping has placeholder
  // customer_id ("TBD") or no matching account exists — caller decides whether
  // Returns the account name for a client_id. The client_id IS the account name
  // (no separate mappings layer). Returns undefined when the account is missing
  // so callers can decide whether to skip or surface a warning.
  function findAccountForClient(clientId: string): string | undefined {
    try {
      const cred = getStore().get(clientId);
      const entry = getStore()
        .list()
        .find((a) => a.customerId === cred.customerId);
      return entry?.name ?? clientId;
    } catch {
      return undefined;
    }
  }

  // Default daily-payload provider: live API path. Fetches AD + AD_CONVERSION
  // for [date-30, date], aggregates via aggregateDailyPayload.
  async function defaultLiveDailyProvider(input: {
    client: string;
    date: string;
  }): Promise<DailyPayload> {
    const targetDate = input.date; // yyyy-mm-dd
    const targetCompact = targetDate.replace(/-/g, "");
    const dod = new Date(`${targetDate}T00:00:00Z`);
    dod.setUTCDate(dod.getUTCDate() - 1);
    const dodIso = dod.toISOString().slice(0, 10);
    const dodCompact = dodIso.replace(/-/g, "");
    const mom = new Date(`${targetDate}T00:00:00Z`);
    mom.setUTCDate(mom.getUTCDate() - 30);
    const momIso = mom.toISOString().slice(0, 10);
    const momCompact = momIso.replace(/-/g, "");

    const accountName = findAccountForClient(input.client);
    if (!accountName) {
      // Mapping missing or customer_id=TBD or no matching account — return
      // empty payload with a warning rather than throwing, so other clients
      // in the loop still process.
      const empty = (): KpiSummary => ({
        impressions: 0,
        clicks: 0,
        cost: 0,
        conversions: 0,
        revenue: 0,
        roas: 0,
      });
      return {
        advertiser: input.client,
        target_date: targetDate,
        compare_dod_date: dodIso,
        compare_mom_date: momIso,
        kpi_target: empty(),
        kpi_dod: empty(),
        kpi_mom: empty(),
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
        derived: {
          roas_mom_pct: null,
          cpc_mom_pct: null,
          impressions_dod_pct: null,
        },
        data_warnings: [
          `client=${input.client}: 광고주-계정 매핑 없음 (customer_id 미설정)`,
        ],
      };
    }

    const apiClient = resolveClient(accountName);

    // Only the 3 dates that matter for the aggregator.
    const dates = [targetCompact, dodCompact, momCompact];
    const [campaigns, adGroups] = await Promise.all([
      getCampaigns(apiClient),
      getAdGroups(apiClient),
    ]);

    const fetchOne = async (
      reportTp: (typeof REPORT_TYPES)[number],
    ): Promise<Record<string, unknown>[]> => {
      const rows: Record<string, unknown>[] = [];
      for (const statDt of dates) {
        try {
          const res = await requestStatReport({
            client: apiClient,
            reportTp,
            statDt,
          });
          rows.push(...(res.rows as Record<string, unknown>[]));
        } catch (err) {
          if (err instanceof StatReportFailedError) continue;
          throw err;
        }
      }
      return rows;
    };

    const [adRows, adConvRows] = await Promise.all([
      fetchOne("AD"),
      fetchOne("AD_CONVERSION"),
    ]);

    const rawDaily = await buildDailyRaw({
      startDate: momCompact,
      endDate: targetCompact,
      fetched: { op: adRows, conv: adConvRows, campaigns, adGroups },
    });

    return aggregateDailyPayload({
      advertiser: input.client,
      // RawRowBase shape is structurally compatible with DailyRawJsonRow
      // (same field names + numeric/string types). The interface adds an
      // `[k: string]: unknown` index signature for forward compatibility,
      // which RawRowBase doesn't declare; cast is safe.
      rows: rawDaily as unknown as Parameters<
        typeof aggregateDailyPayload
      >[0]["rows"],
      targetDate,
      compareDateDoD: dodIso,
      compareDateMoM: momIso,
    });
  }

  const tool_prepare_daily_dashboard = async (
    args: z.infer<typeof PrepareDailySchema>,
  ): Promise<unknown> => {
    const provider = deps.dailyPayloadProvider ?? defaultLiveDailyProvider;
    const accounts = getStore().list();

    const summary: { client: string; violation_count: number }[] = [];
    const allViolations: (ThresholdViolation & { client: string })[] = [];
    const allWarnings: string[] = [];

    for (const acc of accounts) {
      const clientId = acc.name;
      const payload = await provider({ client: clientId, date: args.date });
      const thresholds = resolveThresholds(undefined);
      const violations = evaluateThresholds(payload.derived, thresholds);
      summary.push({ client: clientId, violation_count: violations.length });
      for (const v of violations) {
        allViolations.push({ ...v, client: clientId });
      }
      for (const w of payload.data_warnings) {
        allWarnings.push(`${clientId}: ${w}`);
      }
      const payload_hash = crypto
        .createHash("sha256")
        .update(
          JSON.stringify({ client: clientId, date: args.date, violations }),
        )
        .digest("hex");
      await appendHistory({
        baseDir: HISTORY_BASE_DIR,
        entry: {
          week: args.date,
          client: clientId,
          payload_hash,
          prepared_at: new Date().toISOString(),
          html_path: "",
          xlsx_path: "",
          status: "daily_prepared",
          violation_count: violations.length,
        },
      });
    }

    summary.sort((a, b) => b.violation_count - a.violation_count);

    if (allViolations.length > 0) {
      console.warn(
        JSON.stringify({
          ts: new Date().toISOString(),
          level: "warn",
          op: "prepare_daily_dashboard",
          date: args.date,
          total_violations: allViolations.length,
          by_client: summary.filter((s) => s.violation_count > 0),
        }),
      );
    }

    return {
      date: args.date,
      violations: allViolations,
      summary,
      data_warnings: allWarnings,
    };
  };

  // ---------------------------------------------------------------------------
  // MCP server wiring
  // ---------------------------------------------------------------------------

  const server = new Server(
    { name: "naver-ads-mcp", version: "0.2.0" },
    { capabilities: { tools: {}, resources: {} } },
  );

  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: [
      {
        name: "validate_credentials",
        description:
          "Validate Naver Ads API credentials by calling a lightweight endpoint.",
        inputSchema: {
          type: "object",
          properties: { account: ACCOUNT_SCHEMA_FRAG },
          required: [],
        },
      },
      {
        name: "fetch_raw_data",
        description:
          "Fetch raw stat report rows for a date range and report type. Use outputPath to persist all rows to disk when the response would exceed the MCP 1MB limit, or summarize:true to skip rows and return only counts.",
        inputSchema: {
          type: "object",
          properties: {
            account: ACCOUNT_SCHEMA_FRAG,
            reportTp: {
              type: "string",
              enum: REPORT_TYPES as unknown as string[],
              description: "Report type",
            },
            startDate: { ...YYYYMMDD, description: "Start date YYYYMMDD" },
            endDate: { ...YYYYMMDD, description: "End date YYYYMMDD" },
            outputPath: {
              type: "string",
              description:
                "Absolute path. When set, all rows are written there and the response returns only path + count + perDate.",
            },
            summarize: {
              type: "boolean",
              description:
                "When true, omit rows from the response and return only count + perDate.",
            },
            limit: {
              type: "integer",
              minimum: 1,
              description:
                "Cap number of rows in the response (ignored when outputPath is set).",
            },
          },
          required: ["reportTp", "startDate", "endDate"],
        },
      },
      {
        name: "generate_report",
        description: "Generate a full Excel report (.xlsx) for a date range.",
        inputSchema: {
          type: "object",
          properties: {
            account: ACCOUNT_SCHEMA_FRAG,
            startDate: { ...YYYYMMDD, description: "Start date YYYYMMDD" },
            endDate: { ...YYYYMMDD, description: "End date YYYYMMDD" },
            outputPath: {
              type: "string",
              description: "Absolute path for the output .xlsx file",
            },
          },
          required: ["startDate", "endDate", "outputPath"],
        },
      },
      {
        name: "prepare_weekly_payload",
        description:
          "Stage 1/3 of the weekly report pipeline. Parses the helloMAX form xlsx (or test payloadProvider) into a PrecomputedPayload and returns it together with a Markdown digest the host LLM can drop into its context.",
        inputSchema: {
          type: "object",
          properties: {
            account: ACCOUNT_SCHEMA_FRAG,
            client: {
              type: "string",
              pattern: "^[a-z0-9]+(-[a-z0-9]+)*$",
              description: "Client identifier (kebab-case).",
            },
            week: {
              type: "string",
              pattern: "^\\d{4}-W\\d{2}$",
              description: "ISO week (e.g. 2026-W17).",
            },
            xlsxPath: {
              type: "string",
              description:
                "Absolute path to the AE-uploaded helloMAX form xlsx.",
            },
            targetWeekLabel: {
              type: "string",
              pattern: "^\\d{4}-\\d{2}-\\d{2}주차$",
              description:
                "Weekly label of the current week (e.g. 2026-05-04주차).",
            },
            compareWeekLabel: {
              type: "string",
              pattern: "^\\d{4}-\\d{2}-\\d{2}주차$",
              description: "Weekly label of the comparison week.",
            },
          },
          required: ["client", "week"],
        },
      },
      {
        name: "generate_weekly_analysis_prompt",
        description:
          "Stage 2/3 of the weekly report pipeline. Returns the system_prompt, user_prompt, and expected_schema the host LLM uses to produce the AiAnalysis.",
        inputSchema: {
          type: "object",
          properties: {
            payload: {
              type: "object",
              description:
                "PrecomputedPayload returned by prepare_weekly_payload.",
            },
          },
          required: ["payload"],
        },
      },
      {
        name: "finalize_weekly_dashboard",
        description:
          "Stage 3/3 of the weekly report pipeline. Validates the host-provided AiAnalysis, renders 광고주 발송용 html/xlsx + AE preview artifact, appends a history entry, and returns the file paths and payload_hash.",
        inputSchema: {
          type: "object",
          properties: {
            account: ACCOUNT_SCHEMA_FRAG,
            client: {
              type: "string",
              pattern: "^[a-z0-9]+(-[a-z0-9]+)*$",
              description: "Client identifier (kebab-case).",
            },
            week: {
              type: "string",
              pattern: "^\\d{4}-W\\d{2}$",
              description: "ISO week (e.g. 2026-W17).",
            },
            payload: {
              type: "object",
              description:
                "PrecomputedPayload returned by prepare_weekly_payload.",
            },
            ai_analysis: {
              type: "object",
              description:
                "AiAnalysis the host LLM produced from generate_weekly_analysis_prompt.",
            },
            correction: {
              type: "boolean",
              description:
                "Set true when re-issuing a correction after a sent report contained an error.",
            },
          },
          required: ["client", "week", "payload", "ai_analysis"],
        },
      },
      {
        name: "prepare_daily_dashboard",
        description:
          "Run daily KPI threshold check across all configured advertisers. Returns violation summary sorted by severity. Emits a stdout warn-level JSON line when any breach is detected and appends a daily_prepared entry to the per-client history JSONL.",
        inputSchema: {
          type: "object",
          properties: {
            date: {
              type: "string",
              pattern: "^\\d{4}-\\d{2}-\\d{2}$",
              description: "Target date in YYYY-MM-DD.",
            },
          },
          required: ["date"],
        },
      },
    ],
  }));

  const runValidated = async <S extends z.ZodTypeAny>(
    schema: S,
    rawArgs: unknown,
    fn: (args: z.infer<S>) => Promise<unknown>,
  ) => {
    const parsed = schema.safeParse(rawArgs);
    if (!parsed.success) {
      return {
        content: toContentText({
          error: "Invalid arguments",
          details: parsed.error.flatten(),
        }),
        isError: true,
      };
    }
    return { content: toContentText(await fn(parsed.data)) };
  };

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: rawArgs } = request.params;

    try {
      switch (name) {
        case "validate_credentials":
          return runValidated(
            NoArgsSchema,
            rawArgs ?? {},
            tool_validate_credentials,
          );
        case "fetch_raw_data":
          return runValidated(FetchRawDataSchema, rawArgs, tool_fetch_raw_data);
        case "generate_report":
          return runValidated(
            GenerateReportSchema,
            rawArgs,
            tool_generate_report,
          );
        case "prepare_weekly_payload":
          return runValidated(
            PrepareWeeklyPayloadSchema,
            rawArgs,
            tool_prepare_weekly_payload,
          );
        case "generate_weekly_analysis_prompt":
          return runValidated(
            GenerateWeeklyPromptSchema,
            rawArgs,
            tool_generate_weekly_analysis_prompt,
          );
        case "finalize_weekly_dashboard":
          return runValidated(
            FinalizeWeeklySchema,
            rawArgs,
            tool_finalize_weekly_dashboard,
          );
        case "prepare_daily_dashboard":
          return runValidated(
            PrepareDailySchema,
            rawArgs,
            tool_prepare_daily_dashboard,
          );
        default:
          return {
            content: toContentText({ error: `Unknown tool: ${name}` }),
            isError: true,
          };
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return {
        content: toContentText({ error: message }),
        isError: true,
      };
    }
  });

  const RESOURCES = [
    {
      uri: "naver-ads://report-types",
      name: "Report Types",
      description:
        "Supported Naver Ads report types with descriptions and retention periods.",
      mimeType: "application/json",
    },
    {
      uri: "naver-ads://accounts",
      name: "Accounts",
      description:
        "Configured Naver Ads accounts (name + customerId only — no secrets).",
      mimeType: "application/json",
    },
    {
      uri: "naver-ads://history/{client}",
      name: "Prepare History",
      description:
        "Per-client weekly prepare history (JSONL). Read with naver-ads://history/<client_id>.",
      mimeType: "application/json",
    },
  ] as const;

  server.setRequestHandler(ListResourcesRequestSchema, async () => ({
    resources: RESOURCES.map((r) => ({ ...r })),
  }));

  server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
    const { uri } = request.params;
    switch (uri) {
      case "naver-ads://report-types":
        return {
          contents: [
            {
              uri,
              mimeType: "application/json",
              text: JSON.stringify(tool_list_report_types()),
            },
          ],
        };
      case "naver-ads://accounts":
        return {
          contents: [
            {
              uri,
              mimeType: "application/json",
              text: JSON.stringify(tool_list_accounts()),
            },
          ],
        };
      default: {
        // Templated resources: naver-ads://history/{client}
        const HISTORY_PREFIX = "naver-ads://history/";
        if (uri.startsWith(HISTORY_PREFIX)) {
          const clientId = uri.slice(HISTORY_PREFIX.length);
          if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(clientId)) {
            throw new McpError(
              ErrorCode.InvalidRequest,
              `Invalid client_id in URI: ${uri}`,
            );
          }
          const entries = await readAllHistoryWeeks(HISTORY_BASE_DIR, clientId);
          return {
            contents: [
              {
                uri,
                mimeType: "application/json",
                text: JSON.stringify({ client: clientId, entries }),
              },
            ],
          };
        }
        throw new McpError(
          ErrorCode.InvalidRequest,
          `Unknown resource: ${uri}`,
        );
      }
    }
  });

  return {
    server,
    tools: {
      validate_credentials: tool_validate_credentials,
      list_report_types: tool_list_report_types,
      list_accounts: tool_list_accounts,
      fetch_raw_data: tool_fetch_raw_data,
      generate_report: tool_generate_report,
      prepare_weekly_payload: tool_prepare_weekly_payload,
      generate_weekly_analysis_prompt: tool_generate_weekly_analysis_prompt,
      finalize_weekly_dashboard: tool_finalize_weekly_dashboard,
      prepare_daily_dashboard: tool_prepare_daily_dashboard,
    },
  };
}

// Re-export for cli.ts
export { StdioServerTransport };
