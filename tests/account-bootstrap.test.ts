import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { mkdtempSync, rmSync, writeFileSync, chmodSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import {
  loadAccountStore,
  AccountStoreParseError,
} from "../src/runtime/account-bootstrap.js";

const ENV_KEYS = [
  "NAVER_ADS_CUSTOMER_ID",
  "NAVER_ADS_ACCESS_LICENSE",
  "NAVER_ADS_SECRET_KEY",
  "NAVER_ADS_ACCOUNTS_PATH",
];

let dir: string;
let saved: Record<string, string | undefined>;

beforeEach(() => {
  dir = mkdtempSync(path.join(tmpdir(), "boot-"));
  saved = {};
  for (const k of ENV_KEYS) {
    saved[k] = process.env[k];
    delete process.env[k];
  }
});

afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
  for (const k of ENV_KEYS) {
    if (saved[k] === undefined) delete process.env[k];
    else process.env[k] = saved[k];
  }
});

describe("loadAccountStore — file primary", () => {
  it("loads accounts.json with default + multiple accounts", () => {
    const file = path.join(dir, "accounts.json");
    writeFileSync(
      file,
      JSON.stringify({
        default: "helloMAX",
        accounts: {
          helloMAX: { customerId: "111", accessLicense: "L1", secretKey: "S1" },
          clientB: { customerId: "222", accessLicense: "L2", secretKey: "S2" },
        },
      }),
    );
    process.env.NAVER_ADS_ACCOUNTS_PATH = file;

    const store = loadAccountStore();
    expect(store.default()).toBe("helloMAX");
    expect(store.get("helloMAX").customerId).toBe("111");
    expect(store.get("clientB").customerId).toBe("222");
  });

  it("malformed JSON throws AccountStoreParseError without echoing file content", () => {
    const file = path.join(dir, "accounts.json");
    writeFileSync(file, "{ this is not json: SECRETXYZ }");
    process.env.NAVER_ADS_ACCOUNTS_PATH = file;

    let thrown: unknown;
    try {
      loadAccountStore();
    } catch (e) {
      thrown = e;
    }
    expect(thrown).toBeInstanceOf(AccountStoreParseError);
    expect((thrown as Error).message).not.toContain("SECRETXYZ");
  });

  it("empty {accounts:{}} throws AccountStoreParseError", () => {
    const file = path.join(dir, "accounts.json");
    writeFileSync(file, JSON.stringify({ default: "x", accounts: {} }));
    process.env.NAVER_ADS_ACCOUNTS_PATH = file;

    expect(() => loadAccountStore()).toThrow(AccountStoreParseError);
  });

  it("default key pointing at non-existent account throws AccountStoreParseError", () => {
    const file = path.join(dir, "accounts.json");
    writeFileSync(
      file,
      JSON.stringify({
        default: "missing",
        accounts: {
          realone: { customerId: "1", accessLicense: "L", secretKey: "S" },
        },
      }),
    );
    process.env.NAVER_ADS_ACCOUNTS_PATH = file;

    expect(() => loadAccountStore()).toThrow(AccountStoreParseError);
  });

  it("file mode (mode & 0o077) !== 0 logs stderr warning on POSIX", () => {
    if (process.platform === "win32") return; // skip windows
    const file = path.join(dir, "accounts.json");
    writeFileSync(
      file,
      JSON.stringify({
        default: "a",
        accounts: {
          a: { customerId: "1", accessLicense: "L", secretKey: "S" },
        },
      }),
    );
    chmodSync(file, 0o644);
    process.env.NAVER_ADS_ACCOUNTS_PATH = file;

    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      loadAccountStore();
      const messages = spy.mock.calls.map((args) => args.join(" ")).join("\n");
      expect(messages).toMatch(/permissions/i);
    } finally {
      spy.mockRestore();
    }
  });

  it("file mode 0o600 emits no warning on POSIX", () => {
    if (process.platform === "win32") return;
    const file = path.join(dir, "accounts.json");
    writeFileSync(
      file,
      JSON.stringify({
        default: "a",
        accounts: {
          a: { customerId: "1", accessLicense: "L", secretKey: "S" },
        },
      }),
    );
    chmodSync(file, 0o600);
    process.env.NAVER_ADS_ACCOUNTS_PATH = file;

    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      loadAccountStore();
      expect(spy).not.toHaveBeenCalled();
    } finally {
      spy.mockRestore();
    }
  });
});

describe("loadAccountStore — env fallback", () => {
  it("no file + legacy env vars → synthetic 'default' account", () => {
    process.env.NAVER_ADS_CUSTOMER_ID = "999";
    process.env.NAVER_ADS_ACCESS_LICENSE = "LEG_L";
    process.env.NAVER_ADS_SECRET_KEY = "LEG_S";
    process.env.NAVER_ADS_ACCOUNTS_PATH = path.join(dir, "does-not-exist.json");

    const store = loadAccountStore();
    expect(store.default()).toBe("default");
    expect(store.get(undefined).customerId).toBe("999");
    expect(store.get("default").customerId).toBe("999");
  });

  it("no file + no env vars → AccountStoreParseError", () => {
    process.env.NAVER_ADS_ACCOUNTS_PATH = path.join(dir, "does-not-exist.json");
    expect(() => loadAccountStore()).toThrow(AccountStoreParseError);
  });
});
