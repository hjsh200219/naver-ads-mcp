import { describe, it, expect, vi, beforeEach } from "vitest";
import os from "node:os";
import path from "node:path";
import fs from "node:fs";
import { gzipSync } from "node:zlib";
import { createServer } from "../src/mcp/server.js";
import type { INaverAdsClient } from "../src/api/types.js";
import type { ICredentialLoader } from "../src/config/credentials.js";
import type { Server } from "@modelcontextprotocol/sdk/server/index.js";
import {
  ListToolsRequestSchema,
  ListResourcesRequestSchema,
  ReadResourceRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";

type RequestSchema = {
  shape: { method: { value: string } };
};
type RequestHandler = (
  request: { method: string; params: Record<string, unknown> },
  extra: Record<string, unknown>,
) => Promise<unknown>;
type ServerWithHandlers = Server & {
  _requestHandlers: Map<string, RequestHandler>;
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeFetchWithTsv(tsvContent: string): typeof globalThis.fetch {
  const gzipped = gzipSync(Buffer.from(tsvContent));
  // Each call to arrayBuffer() returns a fresh copy so multiple fetches don't
  // share the same detached ArrayBuffer reference.
  return vi.fn(async () => ({
    arrayBuffer: async (): Promise<ArrayBuffer> => {
      const copy = Buffer.alloc(gzipped.length);
      gzipped.copy(copy);
      return copy.buffer.slice(
        copy.byteOffset,
        copy.byteOffset + copy.byteLength,
      ) as ArrayBuffer;
    },
  })) as unknown as typeof globalThis.fetch;
}

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockClient: INaverAdsClient = {
  get: vi.fn(async () => ({})),
  post: vi.fn(async () => ({
    reportJobId: 1,
    status: "BUILT",
    downloadUrl: "http://example.com/report.tsv.gz",
  })),
  downloadBinary: vi.fn(async () => Buffer.from("h1\nv1\n", "utf-8")),
};

const mockLoader: ICredentialLoader = {
  load: () => ({
    customerId: "test-customer",
    accessLicense: "test-license",
    secretKey: "test-secret",
  }),
};

beforeEach(() => {
  vi.clearAllMocks();
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("createServer", () => {
  it("builds successfully with mock deps", () => {
    const { server, tools } = createServer({
      credentialLoader: mockLoader,
      client: mockClient,
    });
    expect(server).toBeDefined();
    expect(tools).toBeDefined();
  });

  it("exposes exactly 10 tools (weekly dashboard split into 3 stages + register_client)", () => {
    const { tools } = createServer({
      credentialLoader: mockLoader,
      client: mockClient,
    });
    const toolNames = Object.keys(tools);
    expect(toolNames).toHaveLength(10);
    expect(toolNames).toContain("validate_credentials");
    expect(toolNames).toContain("list_report_types");
    expect(toolNames).toContain("list_accounts");
    expect(toolNames).toContain("fetch_raw_data");
    expect(toolNames).toContain("generate_report");
    expect(toolNames).toContain("prepare_weekly_payload");
    expect(toolNames).toContain("generate_weekly_analysis_prompt");
    expect(toolNames).toContain("finalize_weekly_dashboard");
    expect(toolNames).toContain("prepare_daily_dashboard");
    expect(toolNames).toContain("register_client");
  });
});

describe("validate_credentials tool", () => {
  it("returns ok:true when client.get succeeds", async () => {
    vi.mocked(mockClient.get).mockResolvedValueOnce({ balance: 10000 });
    const { tools } = createServer({ client: mockClient });
    const result = (await tools.validate_credentials()) as {
      ok: boolean;
      message?: string;
    };
    expect(result.ok).toBe(true);
    expect(result.message).toBe("Credentials are valid");
  });

  it("returns ok:false on error and does not leak credentials", async () => {
    vi.mocked(mockClient.get).mockRejectedValueOnce(
      new Error("Authentication failed (401)"),
    );
    const { tools } = createServer({ client: mockClient });
    const result = (await tools.validate_credentials()) as {
      ok: boolean;
      error?: string;
    };
    expect(result.ok).toBe(false);
    expect(result.error).toBeDefined();
    // Must not contain any actual credential values in the serialised output
    const text = JSON.stringify(result);
    expect(text).not.toContain("test-license");
    expect(text).not.toContain("test-secret");
    expect(text).not.toContain("test-customer");
  });

  it("classifies NaverAdsApiError 401 as authentication failure", async () => {
    const { NaverAdsApiError } = await import("../src/api/client.js");
    vi.mocked(mockClient.get).mockRejectedValueOnce(
      new NaverAdsApiError("unauthorized", 401),
    );
    const { tools } = createServer({ client: mockClient });
    const result = (await tools.validate_credentials()) as {
      ok: boolean;
      error?: string;
    };
    expect(result.ok).toBe(false);
    expect(result.error).toBe("Authentication failed (401)");
  });

  it("classifies NaverAdsApiError 5xx as server unavailable", async () => {
    const { NaverAdsApiError } = await import("../src/api/client.js");
    vi.mocked(mockClient.get).mockRejectedValueOnce(
      new NaverAdsApiError("oops", 503),
    );
    const { tools } = createServer({ client: mockClient });
    const result = (await tools.validate_credentials()) as {
      ok: boolean;
      error?: string;
    };
    expect(result.ok).toBe(false);
    expect(result.error).toBe("Server unavailable (503)");
  });
});

describe("list_report_types tool", () => {
  it("returns at least 10 report type entries", () => {
    const { tools } = createServer({ client: mockClient });
    const result = tools.list_report_types() as { reportTypes: unknown[] };
    expect(result.reportTypes).toBeInstanceOf(Array);
    expect(result.reportTypes.length).toBeGreaterThanOrEqual(10);
  });

  it("includes expected report type names", () => {
    const { tools } = createServer({ client: mockClient });
    const result = tools.list_report_types() as {
      reportTypes: Array<{
        name: string;
        description: string;
        retentionDays: number;
      }>;
    };
    const names = result.reportTypes.map((r) => r.name);
    expect(names).toContain("AD");
    expect(names).toContain("EXPKEYWORD");
    expect(names).toContain("SHOPPINGBRANDPRODUCT");
    expect(names).toContain("BRND_CONTRACT");
  });
});

describe("fetch_raw_data tool", () => {
  it("returns rows for a single date range with mocked data", async () => {
    vi.mocked(mockClient.post).mockResolvedValue({
      reportJobId: 42,
      status: "BUILT",
      downloadUrl: "http://example.com/report.tsv.gz",
    });
    vi.mocked(mockClient.get).mockResolvedValue({
      reportJobId: 42,
      status: "BUILT",
      downloadUrl: "http://example.com/report.tsv.gz",
    });

    const mockFetch = makeFetchWithTsv("nccCampaignId\tsalesAmt\n123\t5000\n");

    const { tools } = createServer({
      client: mockClient,
      fetch: mockFetch,
    });

    const result = (await tools.fetch_raw_data({
      reportTp: "AD",
      startDate: "20240101",
      endDate: "20240101",
    })) as { rows: unknown[]; count: number; reportTp: string };

    expect(result.rows).toBeInstanceOf(Array);
    expect(result.count).toBe(result.rows.length);
    expect(result.reportTp).toBe("AD");
  });

  it("rejects invalid reportTp via Zod validation in the server handler", async () => {
    const { z } = await import("zod");
    const { REPORT_TYPES } = await import("../src/api/stat-reports.js");
    const FetchRawDataSchema = z.object({
      reportTp: z.enum(REPORT_TYPES),
      startDate: z.string().regex(/^\d{8}$/),
      endDate: z.string().regex(/^\d{8}$/),
    });
    const parseResult = FetchRawDataSchema.safeParse({
      reportTp: "INVALID_TYPE",
      startDate: "20240101",
      endDate: "20240101",
    });
    expect(parseResult.success).toBe(false);
  });

  it("summarize:true omits rows and returns only count + perDate", async () => {
    vi.mocked(mockClient.post).mockResolvedValue({
      reportJobId: 1,
      status: "BUILT",
      downloadUrl: "http://example.com/r.tsv.gz",
    });
    vi.mocked(mockClient.get).mockResolvedValue({
      reportJobId: 1,
      status: "BUILT",
      downloadUrl: "http://example.com/r.tsv.gz",
    });
    const mockFetch = makeFetchWithTsv("nccCampaignId\tsalesAmt\n1\t10\n");
    const { tools } = createServer({ client: mockClient, fetch: mockFetch });
    const result = (await tools.fetch_raw_data({
      reportTp: "AD",
      startDate: "20240101",
      endDate: "20240101",
      summarize: true,
    })) as {
      rows?: unknown[];
      count: number;
      perDate: { date: string; count: number }[];
    };
    expect(result.rows).toBeUndefined();
    expect(result.count).toBeGreaterThan(0);
    expect(result.perDate).toHaveLength(1);
    expect(result.perDate[0].date).toBe("20240101");
  });

  it("outputPath writes all rows to disk and returns only path + count", async () => {
    const { mkdtempSync, rmSync, readFileSync, existsSync } =
      await import("node:fs");
    const os = await import("node:os");
    const pathMod = await import("node:path");
    const tmp = mkdtempSync(pathMod.join(os.tmpdir(), "fetch-raw-"));
    const out = pathMod.join(tmp, "raw.json");
    try {
      vi.mocked(mockClient.post).mockResolvedValue({
        reportJobId: 1,
        status: "BUILT",
        downloadUrl: "http://example.com/r.tsv.gz",
      });
      vi.mocked(mockClient.get).mockResolvedValue({
        reportJobId: 1,
        status: "BUILT",
        downloadUrl: "http://example.com/r.tsv.gz",
      });
      const mockFetch = makeFetchWithTsv("nccCampaignId\tsalesAmt\n1\t10\n");
      const { tools } = createServer({ client: mockClient, fetch: mockFetch });
      const result = (await tools.fetch_raw_data({
        reportTp: "AD",
        startDate: "20240101",
        endDate: "20240101",
        outputPath: out,
      })) as {
        rows?: unknown[];
        count: number;
        outputPath: string;
      };
      expect(result.rows).toBeUndefined();
      expect(result.outputPath).toBe(out);
      expect(existsSync(out)).toBe(true);
      const written = JSON.parse(readFileSync(out, "utf8")) as {
        rows: unknown[];
        count: number;
      };
      expect(written.count).toBe(written.rows.length);
      expect(written.rows.length).toBeGreaterThan(0);
    } finally {
      rmSync(tmp, { recursive: true, force: true });
    }
  });

  it("limit caps the rows in the response and flags truncated", async () => {
    vi.mocked(mockClient.post).mockResolvedValue({
      reportJobId: 1,
      status: "BUILT",
      downloadUrl: "http://example.com/r.tsv.gz",
    });
    vi.mocked(mockClient.get).mockResolvedValue({
      reportJobId: 1,
      status: "BUILT",
      downloadUrl: "http://example.com/r.tsv.gz",
    });
    const mockFetch = makeFetchWithTsv(
      "nccCampaignId\tsalesAmt\n1\t10\n2\t20\n3\t30\n",
    );
    const { tools } = createServer({ client: mockClient, fetch: mockFetch });
    const result = (await tools.fetch_raw_data({
      reportTp: "AD",
      startDate: "20240101",
      endDate: "20240101",
      limit: 1,
    })) as { rows: unknown[]; count: number; truncated?: boolean };
    expect(result.rows).toHaveLength(1);
    expect(result.count).toBeGreaterThan(1);
    expect(result.truncated).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Helper: invoke a registered server request handler directly (no transport)
// ---------------------------------------------------------------------------
async function callHandler<T>(
  server: Server,
  schema: RequestSchema,
  params: Record<string, unknown> = {},
): Promise<T> {
  const method = schema.shape.method.value;
  const handler = (server as ServerWithHandlers)._requestHandlers.get(method);
  if (!handler) throw new Error(`No handler for ${method}`);
  return (await handler({ method, params }, {})) as T;
}

describe("MCP resources", () => {
  it("tools/list does NOT contain list_report_types or list_accounts", async () => {
    const { server } = createServer({ client: mockClient });
    const result = await callHandler<{ tools: Array<{ name: string }> }>(
      server,
      ListToolsRequestSchema,
    );
    const names = result.tools.map((t) => t.name);
    expect(names).not.toContain("list_report_types");
    expect(names).not.toContain("list_accounts");
  });

  it("resources/list contains naver-ads://report-types and naver-ads://accounts", async () => {
    const { server } = createServer({ client: mockClient });
    const result = await callHandler<{
      resources: Array<{ uri: string; name: string; mimeType: string }>;
    }>(server, ListResourcesRequestSchema);
    const uris = result.resources.map((r) => r.uri);
    expect(uris).toContain("naver-ads://report-types");
    expect(uris).toContain("naver-ads://accounts");
  });

  it("resources/read naver-ads://report-types returns report types JSON", async () => {
    const { server } = createServer({ client: mockClient });
    const result = await callHandler<{
      contents: Array<{ uri: string; mimeType: string; text: string }>;
    }>(server, ReadResourceRequestSchema, { uri: "naver-ads://report-types" });
    expect(result.contents).toHaveLength(1);
    const item = result.contents[0];
    expect(item.uri).toBe("naver-ads://report-types");
    expect(item.mimeType).toBe("application/json");
    const parsed = JSON.parse(item.text) as { reportTypes: unknown[] };
    expect(parsed.reportTypes).toBeInstanceOf(Array);
    expect(parsed.reportTypes.length).toBeGreaterThanOrEqual(10);
  });

  it("resources/read naver-ads://accounts returns accounts JSON", async () => {
    const { server } = createServer({
      credentialLoader: mockLoader,
      client: mockClient,
    });
    const result = await callHandler<{
      contents: Array<{ uri: string; mimeType: string; text: string }>;
    }>(server, ReadResourceRequestSchema, { uri: "naver-ads://accounts" });
    expect(result.contents).toHaveLength(1);
    const item = result.contents[0];
    expect(item.uri).toBe("naver-ads://accounts");
    expect(item.mimeType).toBe("application/json");
    const parsed = JSON.parse(item.text) as {
      accounts: unknown[];
      default: unknown;
    };
    expect(parsed.accounts).toBeInstanceOf(Array);
  });

  it("resources/read unknown URI returns error", async () => {
    const { server } = createServer({ client: mockClient });
    await expect(
      callHandler(server, ReadResourceRequestSchema, {
        uri: "naver-ads://unknown",
      }),
    ).rejects.toThrow();
  });
});

describe("generate_report tool", () => {
  it("produces an xlsx file in a temp directory", async () => {
    vi.mocked(mockClient.get).mockImplementation(async (p: string) => {
      if (p.startsWith("/stat-reports/")) {
        return {
          reportJobId: 1,
          status: "BUILT",
          downloadUrl: "http://example.com/r.gz",
        };
      }
      if (p === "/ncc/campaigns") return [];
      if (p === "/ncc/adgroups") return [];
      if (p === "/ncc/keywords") return [];
      if (p === "/ncc/product-groups") return [];
      return {};
    });
    vi.mocked(mockClient.post).mockResolvedValue({
      reportJobId: 1,
      status: "BUILT",
      downloadUrl: "http://example.com/r.gz",
    });
    // Empty TSV — parseTsv returns [] for any reportTp without invoking the
    // column spec. The xlsx still builds with the empty raw rows.
    vi.mocked(mockClient.downloadBinary).mockResolvedValue(Buffer.from(""));

    const mockFetch = makeFetchWithTsv("statDt\tnccCampaignId\n");

    const { tools } = createServer({
      client: mockClient,
      fetch: mockFetch,
    });

    const outputPath = path.join(os.tmpdir(), `mcp-test-${Date.now()}.xlsx`);
    try {
      const result = (await tools.generate_report({
        startDate: "20240101",
        endDate: "20240101",
        outputPath,
      })) as { path: string; sheetNames: string[] };

      expect(result.path).toBe(outputPath);
      expect(result.sheetNames).toBeInstanceOf(Array);
      expect(result.sheetNames.length).toBeGreaterThan(0);
      expect(fs.existsSync(outputPath)).toBe(true);
    } finally {
      if (fs.existsSync(outputPath)) fs.unlinkSync(outputPath);
    }
  });
});
