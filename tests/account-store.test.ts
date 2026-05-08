import { describe, it, expect } from "vitest";
import {
  MapAccountStore,
  AccountNotFoundError,
} from "../src/config/account-store.js";
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

describe("MapAccountStore", () => {
  it("get(name) returns matching credentials", () => {
    const store = new MapAccountStore({
      defaultName: "helloMAX",
      accounts: new Map([
        ["helloMAX", fakeCred({ customerId: "111" })],
        ["clientB", fakeCred({ customerId: "222" })],
      ]),
    });
    expect(store.get("helloMAX").customerId).toBe("111");
    expect(store.get("clientB").customerId).toBe("222");
  });

  it("get(undefined) returns the default account (test: cache normalization)", () => {
    const store = new MapAccountStore({
      defaultName: "helloMAX",
      accounts: new Map([["helloMAX", fakeCred({ customerId: "111" })]]),
    });
    const a = store.get(undefined);
    const b = store.get("helloMAX");
    expect(a.customerId).toBe("111");
    expect(a).toBe(b); // same instance — cache normalised
  });

  it("get('unknown') throws AccountNotFoundError without echoing the full account list", () => {
    const store = new MapAccountStore({
      defaultName: "helloMAX",
      accounts: new Map([
        ["helloMAX", fakeCred()],
        ["secret-internal", fakeCred()],
      ]),
    });
    let thrown: unknown;
    try {
      store.get("doesnotexist");
    } catch (e) {
      thrown = e;
    }
    expect(thrown).toBeInstanceOf(AccountNotFoundError);
    const msg = (thrown as Error).message;
    // Must NOT echo the full account list (privacy: account names can be tenant identifiers)
    expect(msg).not.toContain("secret-internal");
    expect(msg).not.toContain("helloMAX");
  });

  it("get(undefined) when no default is set throws AccountNotFoundError", () => {
    const store = new MapAccountStore({
      defaultName: undefined,
      accounts: new Map([["onlyone", fakeCred()]]),
    });
    expect(() => store.get(undefined)).toThrow(AccountNotFoundError);
  });

  it("returned credentials retain enumerable:false on accessLicense/secretKey", () => {
    const store = new MapAccountStore({
      defaultName: "a",
      accounts: new Map([
        ["a", fakeCred({ accessLicense: "LIC", secretKey: "SEC" })],
      ]),
    });
    const c = store.get("a");
    expect(JSON.stringify(c)).toBe(JSON.stringify({ customerId: "1" }));
    expect(Object.keys(c)).toEqual(["customerId"]);
  });

  it("list() returns [{name, customerId}] only — no license, no secret", () => {
    const store = new MapAccountStore({
      defaultName: "a",
      accounts: new Map([
        [
          "a",
          fakeCred({
            customerId: "111",
            accessLicense: "LIC-A",
            secretKey: "SEC-A",
          }),
        ],
        [
          "b",
          fakeCred({
            customerId: "222",
            accessLicense: "LIC-B",
            secretKey: "SEC-B",
          }),
        ],
      ]),
    });
    const list = store.list();
    expect(list).toEqual([
      { name: "a", customerId: "111" },
      { name: "b", customerId: "222" },
    ]);
    const dump = JSON.stringify(list);
    expect(dump).not.toContain("LIC-A");
    expect(dump).not.toContain("LIC-B");
    expect(dump).not.toContain("SEC-A");
    expect(dump).not.toContain("SEC-B");
  });

  it("default() returns the configured default account name", () => {
    const store = new MapAccountStore({
      defaultName: "a",
      accounts: new Map([["a", fakeCred()]]),
    });
    expect(store.default()).toBe("a");
  });
});
