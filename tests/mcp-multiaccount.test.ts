import { describe, it, expect, vi } from "vitest";
import { createServer } from "../src/mcp/server.js";
import type { INaverAdsClient } from "../src/api/types.js";
import type { IAccountStore } from "../src/config/account-store.js";
import { MapAccountStore } from "../src/config/account-store.js";
import { freezeCredential } from "../src/config/credentials.js";
import type { NaverAdsCredentials } from "../src/config/credentials.js";

function fakeCred(
  overrides: Partial<NaverAdsCredentials> = {},
): NaverAdsCredentials {
  return freezeCredential(
    overrides.customerId ?? "1",
    overrides.accessLicense ?? "L",
    overrides.secretKey ?? "S",
  );
}

function makeStore(): IAccountStore {
  return new MapAccountStore({
    defaultName: "helloMAX",
    accounts: new Map([
      [
        "helloMAX",
        fakeCred({
          customerId: "111",
          accessLicense: "LIC-A",
          secretKey: "SEC-A",
        }),
      ],
      [
        "clientB",
        fakeCred({
          customerId: "222",
          accessLicense: "LIC-B",
          secretKey: "SEC-B",
        }),
      ],
    ]),
  });
}

const mockClient: INaverAdsClient = {
  get: vi.fn(async () => ({ ok: true })),
  post: vi.fn(async () => ({
    reportJobId: 1,
    status: "BUILT",
    downloadUrl: "",
  })),
  downloadBinary: vi.fn(async () => Buffer.from("", "utf-8")),
};

describe("MCP server: multi-account routing", () => {
  it("validate_credentials({account:'clientB'}) routes to clientB credentials", async () => {
    let observed: string | null = null;
    const factory = (cred: NaverAdsCredentials): INaverAdsClient => {
      observed = cred.customerId;
      return mockClient;
    };
    const { tools } = createServer({
      accountStore: makeStore(),
      clientFactory: factory,
    });
    await tools.validate_credentials({ account: "clientB" });
    expect(observed).toBe("222");
  });

  it("omitted account uses default", async () => {
    let observed: string | null = null;
    const factory = (cred: NaverAdsCredentials): INaverAdsClient => {
      observed = cred.customerId;
      return mockClient;
    };
    const { tools } = createServer({
      accountStore: makeStore(),
      clientFactory: factory,
    });
    await tools.validate_credentials({});
    expect(observed).toBe("111");
  });

  it("account regex violation returns generic error without echoing input", async () => {
    const { tools } = createServer({
      accountStore: makeStore(),
      client: mockClient,
    });
    const result = (await tools.validate_credentials({
      account: "../etc/passwd",
    })) as { ok: boolean; error?: string };
    expect(result.ok).toBe(false);
    expect(result.error).toBeDefined();
    // Must NOT echo the malicious input
    expect(result.error).not.toContain("../etc/passwd");
    expect(result.error).not.toContain("/etc");
  });

  it("list_accounts returns name+customerId only — no secret in any field", async () => {
    const { tools } = createServer({
      accountStore: makeStore(),
      client: mockClient,
    });
    const result = (await tools.list_accounts()) as {
      accounts: Array<{ name: string; customerId: string }>;
      default: string;
    };
    expect(result.default).toBe("helloMAX");
    expect(result.accounts).toEqual([
      { name: "helloMAX", customerId: "111" },
      { name: "clientB", customerId: "222" },
    ]);
    const dump = JSON.stringify(result);
    expect(dump).not.toContain("LIC-A");
    expect(dump).not.toContain("LIC-B");
    expect(dump).not.toContain("SEC-A");
    expect(dump).not.toContain("SEC-B");
  });

  it("unknown account returns error without echoing the full account list", async () => {
    const { tools } = createServer({
      accountStore: makeStore(),
      client: mockClient,
    });
    const result = (await tools.validate_credentials({
      account: "nonexistent",
    })) as { ok: boolean; error?: string };
    expect(result.ok).toBe(false);
    expect(result.error).toBeDefined();
    expect(result.error).not.toContain("helloMAX");
    expect(result.error).not.toContain("clientB");
  });
});
