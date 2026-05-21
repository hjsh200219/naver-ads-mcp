import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync, readFileSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { createServer } from "../src/mcp/server.js";
import {
  MapAccountStore,
  type IAccountStore,
} from "../src/config/account-store.js";
import type { NaverAdsCredentials } from "../src/config/credentials.js";

const FAKE_CRED = (id: string): NaverAdsCredentials => ({
  customerId: id,
  accessLicense: "AKEY",
  secretKey: "SKEY",
});

function makeStore(map: Record<string, string>, def: string): IAccountStore {
  const accounts = new Map(
    Object.entries(map).map(([n, cid]) => [n, FAKE_CRED(cid)]),
  );
  return new MapAccountStore({ accounts, defaultName: def });
}

const mockClient = {
  get: async () => ({}),
  post: async () => ({}),
} as unknown as Parameters<typeof createServer>[0]["client"];

describe("register_client tool", () => {
  let tmp: string;
  let mappingsPath: string;

  beforeEach(() => {
    tmp = mkdtempSync(path.join(os.tmpdir(), "register-client-"));
    mappingsPath = path.join(tmp, "client-mappings.json");
    writeFileSync(mappingsPath, JSON.stringify({ mappings: [] }, null, 2));
  });

  afterEach(() => {
    rmSync(tmp, { recursive: true, force: true });
  });

  it("adds a mapping with explicit customer_id", async () => {
    const { tools } = createServer({
      client: mockClient,
      clientMappingsPath: mappingsPath,
      accountStore: makeStore({ hellomax: "1111111" }, "hellomax"),
    });
    const result = (await tools.register_client({
      client_id: "hellomax",
      display_name: "helloMAX",
      customer_id: "9999999",
      recipients: ["a@b.c"],
    })) as { added: boolean; mapping: { customer_id: string } };
    expect(result.added).toBe(true);
    expect(result.mapping.customer_id).toBe("9999999");
  });

  it("auto-fills customer_id from accounts.json when omitted (match by client_id)", async () => {
    const { tools } = createServer({
      client: mockClient,
      clientMappingsPath: mappingsPath,
      accountStore: makeStore({ hellomax: "1111111" }, "hellomax"),
    });
    const result = (await tools.register_client({
      client_id: "hellomax",
      recipients: ["a@b.c"],
    })) as {
      added: boolean;
      mapping: { customer_id: string; display_name: string };
    };
    expect(result.added).toBe(true);
    expect(result.mapping.customer_id).toBe("1111111");
    expect(result.mapping.display_name).toBe("hellomax");
  });

  it("falls back to default account when client_id has no matching account", async () => {
    const { tools } = createServer({
      client: mockClient,
      clientMappingsPath: mappingsPath,
      accountStore: makeStore({ primary: "5555555" }, "primary"),
    });
    const result = (await tools.register_client({
      client_id: "new-client",
      recipients: [],
    })) as { mapping: { customer_id: string } };
    expect(result.mapping.customer_id).toBe("5555555");
  });

  it("uses explicit account override before client_id match", async () => {
    const { tools } = createServer({
      client: mockClient,
      clientMappingsPath: mappingsPath,
      accountStore: makeStore(
        { hellomax: "1111111", secondary: "2222222" },
        "hellomax",
      ),
    });
    const result = (await tools.register_client({
      client_id: "hellomax",
      account: "secondary",
      recipients: [],
    })) as { mapping: { customer_id: string } };
    expect(result.mapping.customer_id).toBe("2222222");
  });

  it("rejects duplicate without overwrite=true", async () => {
    const { tools } = createServer({
      client: mockClient,
      clientMappingsPath: mappingsPath,
      accountStore: makeStore({ hellomax: "1111111" }, "hellomax"),
    });
    await tools.register_client({
      client_id: "hellomax",
      recipients: [],
    });
    await expect(
      tools.register_client({
        client_id: "hellomax",
        recipients: [],
      }),
    ).rejects.toThrow();
  });

  it("updates with overwrite=true and bumps fields", async () => {
    const { tools } = createServer({
      client: mockClient,
      clientMappingsPath: mappingsPath,
      accountStore: makeStore({ hellomax: "1111111" }, "hellomax"),
    });
    await tools.register_client({
      client_id: "hellomax",
      recipients: ["old@x.com"],
    });
    const out = (await tools.register_client({
      client_id: "hellomax",
      recipients: ["new@x.com"],
      overwrite: true,
    })) as { added: boolean; updated: boolean };
    expect(out.added).toBe(false);
    expect(out.updated).toBe(true);
    const stored = JSON.parse(readFileSync(mappingsPath, "utf8")) as {
      mappings: { recipients: string[] }[];
    };
    expect(stored.mappings[0].recipients).toEqual(["new@x.com"]);
  });

  it("invalidates cached mappings so weekly/daily reads pick up the new entry", async () => {
    const { tools } = createServer({
      client: mockClient,
      clientMappingsPath: mappingsPath,
      accountStore: makeStore({ hellomax: "1111111" }, "hellomax"),
      // Note: do not preload clientMappings; let it read from disk.
    });
    await tools.register_client({
      client_id: "hellomax",
      recipients: [],
    });
    // Second register should see the freshly written file (would conflict
    // unless cache was invalidated and re-read recognises the duplicate).
    await expect(
      tools.register_client({
        client_id: "hellomax",
        recipients: [],
      }),
    ).rejects.toThrow();
  });

  it("throws when no customer_id provided AND no account store entries", async () => {
    const { tools } = createServer({
      client: mockClient,
      clientMappingsPath: mappingsPath,
      // No accountStore — getStore() falls back to env, which is missing in tests.
    });
    await expect(
      tools.register_client({
        client_id: "hellomax",
        recipients: [],
      }),
    ).rejects.toThrow(/customer_id required/);
  });
});

describe("register_client tool surface in ListTools", () => {
  it("appears in tools/list output", async () => {
    const { server } = createServer({
      client: mockClient,
      accountStore: makeStore({ hellomax: "1" }, "hellomax"),
    });
    const { ListToolsRequestSchema } =
      await import("@modelcontextprotocol/sdk/types.js");
    const handler = (
      server as unknown as {
        _requestHandlers: Map<
          string,
          (req: unknown, ctx: unknown) => Promise<{ tools: { name: string }[] }>
        >;
      }
    )._requestHandlers.get(ListToolsRequestSchema.shape.method.value);
    if (!handler) throw new Error("no handler");
    const result = await handler({ method: "tools/list", params: {} }, {});
    const names = result.tools.map((t) => t.name);
    expect(names).toContain("register_client");
  });
});
