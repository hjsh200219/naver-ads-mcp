import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  mkdtempSync,
  rmSync,
  readFileSync,
  existsSync,
  readdirSync,
} from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  appendHistory,
  readHistory,
  HistoryEntrySchema,
  type HistoryEntry,
} from "../src/runtime/history.js";
import { createServer } from "../src/mcp/server.js";
import {
  ReadResourceRequestSchema,
  ListResourcesRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";

let workDir: string;

beforeEach(() => {
  workDir = mkdtempSync(path.join(os.tmpdir(), "naver-ads-history-"));
});

afterEach(() => {
  if (existsSync(workDir)) {
    rmSync(workDir, { recursive: true, force: true });
  }
});

const sampleEntry = (overrides: Partial<HistoryEntry> = {}): HistoryEntry => ({
  week: "2026-W18",
  client: "bishef",
  payload_hash: "a".repeat(64),
  prepared_at: "2026-05-10T07:00:00.000Z",
  html_path: "/tmp/foo.html",
  xlsx_path: "/tmp/foo.xlsx",
  status: "prepared",
  ...overrides,
});

describe("US-014 HistoryEntry schema", () => {
  it("accepts a valid prepared entry", () => {
    const result = HistoryEntrySchema.safeParse(sampleEntry());
    expect(result.success).toBe(true);
  });

  it("accepts status corrected_prepared and prepare_failed", () => {
    expect(
      HistoryEntrySchema.safeParse(
        sampleEntry({ status: "corrected_prepared" }),
      ).success,
    ).toBe(true);
    expect(
      HistoryEntrySchema.safeParse(sampleEntry({ status: "prepare_failed" }))
        .success,
    ).toBe(true);
  });

  it("rejects unknown status", () => {
    expect(
      HistoryEntrySchema.safeParse(sampleEntry({ status: "sent" as never }))
        .success,
    ).toBe(false);
  });

  it("rejects payload_hash that is not 64-char hex", () => {
    expect(
      HistoryEntrySchema.safeParse(sampleEntry({ payload_hash: "not-a-hash" }))
        .success,
    ).toBe(false);
  });

  it("rejects week format other than YYYY-Www", () => {
    expect(
      HistoryEntrySchema.safeParse(sampleEntry({ week: "2026-05-08" })).success,
    ).toBe(false);
  });

  it("rejects unknown extra keys (strict)", () => {
    const bad = { ...sampleEntry(), recipient_email: "x@y.z" };
    const result = HistoryEntrySchema.safeParse(bad);
    expect(result.success).toBe(false);
  });
});

describe("US-014 appendHistory atomic write + read", () => {
  it("appends one line per call", async () => {
    await appendHistory({ baseDir: workDir, entry: sampleEntry() });
    await appendHistory({
      baseDir: workDir,
      entry: sampleEntry({ payload_hash: "b".repeat(64) }),
    });
    const file = path.join(workDir, "bishef", "2026-W18.jsonl");
    const lines = readFileSync(file, "utf8").trim().split("\n");
    expect(lines).toHaveLength(2);
    const a = JSON.parse(lines[0]) as HistoryEntry;
    const b = JSON.parse(lines[1]) as HistoryEntry;
    expect(a.payload_hash[0]).toBe("a");
    expect(b.payload_hash[0]).toBe("b");
  });

  it("creates nested directory if missing", async () => {
    await appendHistory({
      baseDir: workDir,
      entry: sampleEntry({ client: "fashion-for-you", week: "2026-W19" }),
    });
    expect(
      existsSync(path.join(workDir, "fashion-for-you", "2026-W19.jsonl")),
    ).toBe(true);
  });

  it("readHistory returns parsed entries in append order", async () => {
    const a = sampleEntry();
    const b = sampleEntry({ payload_hash: "b".repeat(64) });
    await appendHistory({ baseDir: workDir, entry: a });
    await appendHistory({ baseDir: workDir, entry: b });
    const out = await readHistory({
      baseDir: workDir,
      client: "bishef",
      week: "2026-W18",
    });
    expect(out).toHaveLength(2);
    expect(out[0].payload_hash).toBe(a.payload_hash);
    expect(out[1].payload_hash).toBe(b.payload_hash);
  });

  it("readHistory returns empty array when file missing", async () => {
    const out = await readHistory({
      baseDir: workDir,
      client: "no-such",
      week: "2026-W01",
    });
    expect(out).toEqual([]);
  });

  it("rejects invalid entry without writing the file", async () => {
    const bad = {
      ...sampleEntry(),
      status: "weird",
    } as unknown as HistoryEntry;
    await expect(
      appendHistory({ baseDir: workDir, entry: bad }),
    ).rejects.toThrow();
    expect(existsSync(path.join(workDir, "bishef"))).toBe(false);
  });

  it("does not leave .tmp temp files behind on success", async () => {
    await appendHistory({ baseDir: workDir, entry: sampleEntry() });
    const dir = path.join(workDir, "bishef");
    const files = readdirSync(dir);
    expect(files.some((f) => f.endsWith(".tmp"))).toBe(false);
  });

  it("concurrent appends to same (client, week) serialize via lock", async () => {
    const entries = Array.from({ length: 5 }, (_, i) =>
      sampleEntry({ payload_hash: String(i).padStart(64, "0") }),
    );
    await Promise.all(
      entries.map((e) => appendHistory({ baseDir: workDir, entry: e })),
    );
    const out = await readHistory({
      baseDir: workDir,
      client: "bishef",
      week: "2026-W18",
    });
    expect(out).toHaveLength(5);
    // All 5 distinct hashes preserved (no overwrite)
    const hashes = new Set(out.map((e) => e.payload_hash));
    expect(hashes.size).toBe(5);
  });
});

describe("US-014 MCP history resource integration", () => {
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

  const stubClient = {
    get: async () => ({}),
    post: async () => ({}),
  } as unknown as Parameters<typeof createServer>[0]["client"];

  it("registers naver-ads://history/{client} in resource list", async () => {
    const { server } = createServer({
      client: stubClient,
      historyBaseDir: workDir,
    });
    const out = await callHandler<{ resources: Array<{ uri: string }> }>(
      server as unknown as { _requestHandlers: Map<string, unknown> },
      ListResourcesRequestSchema.shape.method.value,
    );
    const uris = out.resources.map((r) => r.uri);
    expect(uris).toContain("naver-ads://history/{client}");
  });

  it("ReadResource naver-ads://history/<client> returns appended entries", async () => {
    await appendHistory({ baseDir: workDir, entry: sampleEntry() });
    const { server } = createServer({
      client: stubClient,
      historyBaseDir: workDir,
    });
    const out = await callHandler<{
      contents: Array<{ uri: string; text: string }>;
    }>(
      server as unknown as { _requestHandlers: Map<string, unknown> },
      ReadResourceRequestSchema.shape.method.value,
      { uri: "naver-ads://history/bishef" },
    );
    const item = out.contents[0];
    expect(item.uri).toBe("naver-ads://history/bishef");
    const parsed = JSON.parse(item.text) as {
      client: string;
      entries: HistoryEntry[];
    };
    expect(parsed.client).toBe("bishef");
    expect(parsed.entries).toHaveLength(1);
  });

  it("returns empty entries for unknown client", async () => {
    const { server } = createServer({
      client: stubClient,
      historyBaseDir: workDir,
    });
    const out = await callHandler<{
      contents: Array<{ uri: string; text: string }>;
    }>(
      server as unknown as { _requestHandlers: Map<string, unknown> },
      ReadResourceRequestSchema.shape.method.value,
      { uri: "naver-ads://history/no-such-client" },
    );
    const parsed = JSON.parse(out.contents[0].text) as {
      entries: unknown[];
    };
    expect(parsed.entries).toEqual([]);
  });

  it("rejects malformed client_id in URI", async () => {
    const { server } = createServer({
      client: stubClient,
      historyBaseDir: workDir,
    });
    await expect(
      callHandler(
        server as unknown as { _requestHandlers: Map<string, unknown> },
        ReadResourceRequestSchema.shape.method.value,
        { uri: "naver-ads://history/Bad_ID" },
      ),
    ).rejects.toThrow();
  });
});
