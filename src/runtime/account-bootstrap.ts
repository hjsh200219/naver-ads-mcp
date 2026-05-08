// L1 runtime helper: reads `accounts.json` from disk OR falls back to legacy
// single-account env vars, and produces an in-memory `MapAccountStore`.
//
// Layer rules:
// - This file may import `node:fs` and `node:path` (it's L1).
// - L4 (`src/config/*`) must remain free of `node:fs`.

import { readFileSync, statSync } from "node:fs";
import path from "node:path";
import type { NaverAdsCredentials } from "../config/credentials.js";
import {
  EnvCredentialLoader,
  freezeCredential,
} from "../config/credentials.js";
import { MapAccountStore } from "../config/account-store.js";
import type { IAccountStore } from "../config/account-store.js";

export class AccountStoreParseError extends Error {
  constructor(reason: string) {
    super(`Account store: ${reason}`);
    this.name = "AccountStoreParseError";
  }
}

const ENV_PATH = "NAVER_ADS_ACCOUNTS_PATH";
const DEFAULT_FILE = "accounts.json";

interface RawFileShape {
  default?: unknown;
  accounts?: unknown;
}

function resolveAccountsPath(): string {
  const fromEnv = process.env[ENV_PATH];
  if (fromEnv && fromEnv.trim() !== "") {
    return path.resolve(fromEnv.trim());
  }
  return path.resolve(process.cwd(), DEFAULT_FILE);
}

interface FileBundle {
  content: string;
  modeOctal: number; // 0..0o777, or -1 if unavailable (Windows)
}

/**
 * Reads the file and stat in a single sequence. Returns null if the file
 * doesn't exist; throws on other errors.
 */
function readFileBundle(p: string): FileBundle | null {
  let modeOctal = -1;
  try {
    if (process.platform !== "win32") {
      modeOctal = statSync(p).mode & 0o777;
    }
    const content = readFileSync(p, "utf8");
    return { content, modeOctal };
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw err;
  }
}

function warnIfFilePermissive(filePath: string, modeOctal: number): void {
  if (modeOctal < 0) return; // Windows or unavailable
  if ((modeOctal & 0o077) === 0) return;
  console.error(
    `[naver-ads-mcp] WARNING: ${path.basename(filePath)} permissions ${modeOctal.toString(8)} ` +
      `allow group/other access. Run "chmod 600 ${filePath}" to restrict.`,
  );
}

function parseAccountsObject(raw: unknown): MapAccountStore {
  if (typeof raw !== "object" || raw === null) {
    throw new AccountStoreParseError("file root is not an object");
  }
  const data = raw as RawFileShape;

  if (typeof data.accounts !== "object" || data.accounts === null) {
    throw new AccountStoreParseError("'accounts' object is missing or invalid");
  }
  const entries = Object.entries(data.accounts as Record<string, unknown>);
  if (entries.length === 0) {
    throw new AccountStoreParseError("'accounts' object is empty");
  }

  const accounts = new Map<string, NaverAdsCredentials>();
  for (const [name, value] of entries) {
    if (typeof value !== "object" || value === null) {
      throw new AccountStoreParseError(`account '${name}' must be an object`);
    }
    const v = value as Record<string, unknown>;
    if (typeof v.customerId !== "string" || v.customerId.trim() === "") {
      throw new AccountStoreParseError(`account '${name}' missing customerId`);
    }
    if (typeof v.accessLicense !== "string" || v.accessLicense.trim() === "") {
      throw new AccountStoreParseError(
        `account '${name}' missing accessLicense`,
      );
    }
    if (typeof v.secretKey !== "string" || v.secretKey.trim() === "") {
      throw new AccountStoreParseError(`account '${name}' missing secretKey`);
    }
    accounts.set(
      name,
      freezeCredential(
        v.customerId.trim(),
        v.accessLicense.trim(),
        v.secretKey.trim(),
      ),
    );
  }

  let defaultName: string | undefined;
  if (data.default !== undefined) {
    if (typeof data.default !== "string") {
      throw new AccountStoreParseError("'default' must be a string");
    }
    if (!accounts.has(data.default)) {
      throw new AccountStoreParseError("'default' references unknown account");
    }
    defaultName = data.default;
  } else if (accounts.size === 1) {
    defaultName = entries[0]![0];
  }
  return new MapAccountStore({ accounts, defaultName });
}

function tryEnvFallback(): MapAccountStore | null {
  try {
    const cred = new EnvCredentialLoader().load();
    const accounts = new Map<string, NaverAdsCredentials>();
    accounts.set("default", cred);
    return new MapAccountStore({ accounts, defaultName: "default" });
  } catch {
    return null;
  }
}

/**
 * Loads the account store. Order of precedence:
 *   1. accounts.json at `NAVER_ADS_ACCOUNTS_PATH` (or `./accounts.json`)
 *   2. Legacy single-account env vars (NAVER_ADS_CUSTOMER_ID/...)
 *
 * Throws AccountStoreParseError if neither source is usable.
 */
export function loadAccountStore(): IAccountStore {
  const filePath = resolveAccountsPath();
  const bundle = readFileBundle(filePath);

  if (bundle !== null) {
    warnIfFilePermissive(filePath, bundle.modeOctal);
    let parsed: unknown;
    try {
      parsed = JSON.parse(bundle.content);
    } catch {
      throw new AccountStoreParseError("invalid JSON");
    }
    return parseAccountsObject(parsed);
  }

  const envStore = tryEnvFallback();
  if (envStore) return envStore;

  throw new AccountStoreParseError(
    "no accounts.json found and no legacy NAVER_ADS_* env vars configured",
  );
}
