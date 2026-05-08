import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
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
import { REPORT_TYPES, requestStatReport } from "../api/stat-reports.js";
import {
  getCampaigns,
  getAdGroups,
  getKeywords,
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
});

const GenerateReportSchema = z.object({
  account: AccountSchema,
  startDate: z.string().regex(/^\d{8}$/),
  endDate: z.string().regex(/^\d{8}$/),
  outputPath: z.string(),
});

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
    const { reportTp, startDate, endDate, account } = args;
    const client = resolveClient(account);
    const dates = enumerateDates(startDate, endDate);
    const allRows: Record<string, string>[] = [];
    for (const statDt of dates) {
      const result = await requestStatReport({
        client,
        reportTp,
        statDt,
        fetch: deps.fetch,
      });
      allRows.push(...result.rows);
    }
    return {
      rows: allRows,
      count: allRows.length,
      reportTp,
      startDate,
      endDate,
    };
  };

  const tool_generate_report = async (
    args: z.infer<typeof GenerateReportSchema>,
  ) => {
    const { startDate, endDate, outputPath, account } = args;
    const client = resolveClient(account);
    const dates = enumerateDates(startDate, endDate);

    const [campaigns, adGroups, keywords, products] = await Promise.all([
      getCampaigns(client),
      getAdGroups(client),
      getKeywords(client),
      getProducts(client),
    ]);

    const fetchAll = async (
      reportTp: (typeof REPORT_TYPES)[number],
    ): Promise<Record<string, string>[]> => {
      try {
        const rows: Record<string, string>[] = [];
        for (const statDt of dates) {
          const result = await requestStatReport({
            client,
            reportTp,
            statDt,
            fetch: deps.fetch,
          });
          rows.push(...result.rows);
        }
        return rows;
      } catch {
        return [];
      }
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

  // ---------------------------------------------------------------------------
  // MCP server wiring
  // ---------------------------------------------------------------------------

  const server = new Server(
    { name: "naver-ads-mcp", version: "0.2.0" },
    { capabilities: { tools: {} } },
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
        name: "list_report_types",
        description:
          "List supported Naver Ads report types with descriptions and retention periods.",
        inputSchema: { type: "object", properties: {}, required: [] },
      },
      {
        name: "list_accounts",
        description:
          "List configured Naver Ads accounts (name + customerId only — never licenses or secrets).",
        inputSchema: { type: "object", properties: {}, required: [] },
      },
      {
        name: "fetch_raw_data",
        description:
          "Fetch raw stat report rows for a date range and report type.",
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
        case "list_report_types":
          return { content: toContentText(tool_list_report_types()) };
        case "list_accounts":
          return { content: toContentText(tool_list_accounts()) };
        case "fetch_raw_data":
          return runValidated(FetchRawDataSchema, rawArgs, tool_fetch_raw_data);
        case "generate_report":
          return runValidated(
            GenerateReportSchema,
            rawArgs,
            tool_generate_report,
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

  return {
    server,
    tools: {
      validate_credentials: tool_validate_credentials,
      list_report_types: tool_list_report_types,
      list_accounts: tool_list_accounts,
      fetch_raw_data: tool_fetch_raw_data,
      generate_report: tool_generate_report,
    },
  };
}

// Re-export for cli.ts
export { StdioServerTransport };
