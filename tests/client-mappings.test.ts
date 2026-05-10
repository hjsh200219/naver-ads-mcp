import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import {
  ClientMappingSchema,
  ClientMappingsFileSchema,
  toPublicResourcePayload,
  type ClientMapping,
} from "../src/config/client-mappings.js";
import { loadClientMappings } from "../src/runtime/client-mappings-loader.js";

const root = path.resolve(__dirname, "..");

describe("US-013 ClientMapping zod schema", () => {
  const validMapping: ClientMapping = {
    client_id: "bishef",
    display_name: "비셰프",
    customer_id: "1234567",
    recipients: ["client@example.com"],
    cc: ["ae@zbros.co.kr"],
    automation_enabled: true,
    notes: "샘플",
  };

  it("accepts a valid mapping", () => {
    const result = ClientMappingSchema.safeParse(validMapping);
    expect(result.success).toBe(true);
  });

  it("accepts TBD placeholders for display_name and customer_id", () => {
    const tbd = { ...validMapping, display_name: "TBD", customer_id: "TBD" };
    const result = ClientMappingSchema.safeParse(tbd);
    expect(result.success).toBe(true);
  });

  it("defaults automation_enabled to true when omitted", () => {
    const without = { ...validMapping };
    delete (without as { automation_enabled?: boolean }).automation_enabled;
    const result = ClientMappingSchema.safeParse(without);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.automation_enabled).toBe(true);
    }
  });

  it("rejects unknown keys (strict)", () => {
    const extra = { ...validMapping, evil_field: "x" };
    const result = ClientMappingSchema.safeParse(extra);
    expect(result.success).toBe(false);
  });

  it("rejects non-kebab-case client_id", () => {
    const camel = { ...validMapping, client_id: "BiShef" };
    const result = ClientMappingSchema.safeParse(camel);
    expect(result.success).toBe(false);
  });

  it("rejects underscore in client_id", () => {
    const snake = { ...validMapping, client_id: "bishef_one" };
    const result = ClientMappingSchema.safeParse(snake);
    expect(result.success).toBe(false);
  });

  it("rejects missing required fields", () => {
    const noRecipients = { ...validMapping };
    delete (noRecipients as { recipients?: string[] }).recipients;
    const result = ClientMappingSchema.safeParse(noRecipients);
    expect(result.success).toBe(false);
  });

  it("rejects non-array recipients", () => {
    const bad = { ...validMapping, recipients: "single@example.com" };
    const result = ClientMappingSchema.safeParse(bad);
    expect(result.success).toBe(false);
  });
});

describe("US-013 ClientMappingsFile schema", () => {
  it("rejects duplicate client_id within the file", () => {
    const dup = {
      mappings: [
        {
          client_id: "bishef",
          display_name: "TBD",
          customer_id: "TBD",
          recipients: [],
          cc: [],
          automation_enabled: true,
        },
        {
          client_id: "bishef",
          display_name: "TBD",
          customer_id: "TBD",
          recipients: [],
          cc: [],
          automation_enabled: true,
        },
      ],
    };
    const result = ClientMappingsFileSchema.safeParse(dup);
    expect(result.success).toBe(false);
  });

  it("accepts empty recipients/cc (placeholder state)", () => {
    const placeholder = {
      mappings: [
        {
          client_id: "client-1",
          display_name: "TBD",
          customer_id: "TBD",
          recipients: [],
          cc: [],
          automation_enabled: true,
        },
      ],
    };
    const result = ClientMappingsFileSchema.safeParse(placeholder);
    expect(result.success).toBe(true);
  });
});

describe("US-013 src/config/client-mappings.json file", () => {
  const filePath = path.join(root, "src/config/client-mappings.json");

  it("file exists and is valid JSON", () => {
    const content = readFileSync(filePath, "utf8");
    const parsed = JSON.parse(content) as unknown;
    expect(parsed).toBeDefined();
  });

  it("parses cleanly under ClientMappingsFileSchema", () => {
    const content = readFileSync(filePath, "utf8");
    const parsed = JSON.parse(content) as unknown;
    const result = ClientMappingsFileSchema.safeParse(parsed);
    expect(result.success).toBe(true);
  });

  it("contains exactly 6 placeholder entries", () => {
    const content = readFileSync(filePath, "utf8");
    const parsed = JSON.parse(content) as { mappings: unknown[] };
    expect(parsed.mappings).toHaveLength(6);
  });

  it("all 6 entries have unique client_id", () => {
    const content = readFileSync(filePath, "utf8");
    const parsed = JSON.parse(content) as {
      mappings: { client_id: string }[];
    };
    const ids = parsed.mappings.map((m) => m.client_id);
    const unique = new Set(ids);
    expect(unique.size).toBe(6);
  });
});

describe("US-013 loadClientMappings()", () => {
  it("loads and validates the default file from disk", () => {
    const data = loadClientMappings();
    expect(data.mappings).toHaveLength(6);
    expect(data.mappings.every((m) => typeof m.client_id === "string")).toBe(
      true,
    );
  });

  it("throws on bogus path", () => {
    expect(() => loadClientMappings("/nonexistent/file.json")).toThrow();
  });
});

describe("US-013 toPublicResourcePayload — PII redaction", () => {
  const mapping: ClientMapping = {
    client_id: "bishef",
    display_name: "비셰프",
    customer_id: "1234567",
    recipients: ["secret@example.com"],
    cc: ["confidential@example.com"],
    automation_enabled: true,
  };

  it("strips recipients and cc from resource payload", () => {
    const payload = toPublicResourcePayload({ mappings: [mapping] });
    const text = JSON.stringify(payload);
    expect(text).not.toContain("secret@example.com");
    expect(text).not.toContain("confidential@example.com");
  });

  it("retains client_id, display_name, customer_id, automation_enabled", () => {
    const payload = toPublicResourcePayload({ mappings: [mapping] });
    expect(payload.mappings[0]).toMatchObject({
      client_id: "bishef",
      display_name: "비셰프",
      customer_id: "1234567",
      automation_enabled: true,
    });
  });

  it("does not expose recipients/cc keys at all (not even as empty arrays)", () => {
    const payload = toPublicResourcePayload({ mappings: [mapping] });
    expect(payload.mappings[0]).not.toHaveProperty("recipients");
    expect(payload.mappings[0]).not.toHaveProperty("cc");
  });
});

describe("US-013 MCP resource integration (AC #16)", () => {
  async function buildServer() {
    const { ListResourcesRequestSchema, ReadResourceRequestSchema } =
      await import("@modelcontextprotocol/sdk/types.js");
    const { createServer } = await import("../src/mcp/server.js");
    const { server } = createServer({
      client: {
        get: async () => ({}),
        post: async () => ({}),
      } as unknown as Parameters<typeof createServer>[0]["client"],
    });
    return { server, ListResourcesRequestSchema, ReadResourceRequestSchema };
  }

  async function callHandler<T>(
    server: { _requestHandlers: Map<string, unknown> },
    method: string,
    params: Record<string, unknown> = {},
  ): Promise<T> {
    const handler = server._requestHandlers.get(method) as
      | ((req: { method: string; params: unknown }, ctx: unknown) => Promise<T>)
      | undefined;
    if (!handler) throw new Error(`No handler for ${method}`);
    return await handler({ method, params }, {});
  }

  it("createServer registers naver-ads://client-mappings in the resource list", async () => {
    const { server, ListResourcesRequestSchema } = await buildServer();
    const out = await callHandler<{ resources: Array<{ uri: string }> }>(
      server as unknown as { _requestHandlers: Map<string, unknown> },
      ListResourcesRequestSchema.shape.method.value,
    );
    const uris = out.resources.map((r) => r.uri);
    expect(uris).toContain("naver-ads://client-mappings");
  });

  it("ReadResource for naver-ads://client-mappings returns redacted JSON", async () => {
    const { server, ReadResourceRequestSchema } = await buildServer();
    const out = await callHandler<{
      contents: Array<{ uri: string; mimeType: string; text: string }>;
    }>(
      server as unknown as { _requestHandlers: Map<string, unknown> },
      ReadResourceRequestSchema.shape.method.value,
      { uri: "naver-ads://client-mappings" },
    );
    const item = out.contents[0];
    expect(item.uri).toBe("naver-ads://client-mappings");
    expect(item.mimeType).toBe("application/json");
    const parsed = JSON.parse(item.text) as {
      mappings: { client_id: string }[];
    };
    expect(parsed.mappings).toHaveLength(6);
    expect(item.text).not.toMatch(/recipients/);
    expect(item.text).not.toMatch(/"cc"/);
  });
});

describe("US-018 daily_thresholds extension", () => {
  const baseMapping: ClientMapping = {
    client_id: "bishef",
    display_name: "비셰프",
    customer_id: "1234567",
    recipients: [],
    cc: [],
    automation_enabled: true,
  };

  it("accepts mapping without daily_thresholds (default path)", () => {
    const result = ClientMappingSchema.safeParse(baseMapping);
    expect(result.success).toBe(true);
  });

  it("accepts mapping with valid daily_thresholds partial", () => {
    const m = { ...baseMapping, daily_thresholds: { roas_mom_pct: -25 } };
    const result = ClientMappingSchema.safeParse(m);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.daily_thresholds).toEqual({ roas_mom_pct: -25 });
    }
  });

  it("accepts full daily_thresholds override", () => {
    const m = {
      ...baseMapping,
      daily_thresholds: {
        roas_mom_pct: -10,
        cpc_mom_pct: 40,
        impressions_dod_pct: -30,
      },
    };
    const result = ClientMappingSchema.safeParse(m);
    expect(result.success).toBe(true);
  });

  it("rejects daily_thresholds with non-numeric value", () => {
    const m = {
      ...baseMapping,
      daily_thresholds: { roas_mom_pct: "bad" },
    };
    const result = ClientMappingSchema.safeParse(m);
    expect(result.success).toBe(false);
  });

  it("rejects daily_thresholds with unknown nested field", () => {
    const m = {
      ...baseMapping,
      daily_thresholds: { roas_mom_pct: -20, unknown_metric: 1 },
    };
    const result = ClientMappingSchema.safeParse(m);
    expect(result.success).toBe(false);
  });

  it("toPublicResourcePayload preserves daily_thresholds when present", () => {
    const file = {
      mappings: [
        {
          ...baseMapping,
          daily_thresholds: { cpc_mom_pct: 50 },
        },
      ],
    };
    const parsed = ClientMappingsFileSchema.parse(file);
    const pub = toPublicResourcePayload(parsed);
    expect(pub.mappings[0].daily_thresholds).toEqual({ cpc_mom_pct: 50 });
  });

  it("toPublicResourcePayload omits daily_thresholds when absent", () => {
    const file = { mappings: [baseMapping] };
    const parsed = ClientMappingsFileSchema.parse(file);
    const pub = toPublicResourcePayload(parsed);
    expect(pub.mappings[0].daily_thresholds).toBeUndefined();
  });
});
