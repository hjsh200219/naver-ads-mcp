// Multi-account credential registry. Pure L4 — no `node:fs`, no I/O.
// File reading + env fallback live in L1 (src/runtime/account-bootstrap.ts);
// they hand a populated `MapAccountStore` to the MCP server.

import type { NaverAdsCredentials } from "./credentials.js";

export class AccountNotFoundError extends Error {
  constructor() {
    // Generic message — no account name, no list. Tenant identifiers
    // would otherwise leak into MCP host transcripts.
    super("Account not found");
    this.name = "AccountNotFoundError";
  }
}

export interface AccountListEntry {
  name: string;
  customerId: string;
}

export interface IAccountStore {
  /** Returns the credential for `name`, or the default account if `name` is undefined. */
  get(name?: string): NaverAdsCredentials;
  /** Returns public account info — never license/secret. */
  list(): AccountListEntry[];
  /** Returns the default account name, or undefined if no default is configured. */
  default(): string | undefined;
}

export interface MapAccountStoreInit {
  defaultName: string | undefined;
  accounts: Map<string, NaverAdsCredentials>;
}

export class MapAccountStore implements IAccountStore {
  private readonly accounts: Map<string, NaverAdsCredentials>;
  private readonly defaultName: string | undefined;

  constructor(init: MapAccountStoreInit) {
    this.accounts = init.accounts;
    this.defaultName = init.defaultName;
  }

  get(name?: string): NaverAdsCredentials {
    const key = name ?? this.defaultName;
    if (key === undefined) throw new AccountNotFoundError();
    const cred = this.accounts.get(key);
    if (cred === undefined) throw new AccountNotFoundError();
    return cred;
  }

  list(): AccountListEntry[] {
    return Array.from(this.accounts.entries()).map(([name, cred]) => ({
      name,
      customerId: cred.customerId,
    }));
  }

  default(): string | undefined {
    return this.defaultName;
  }
}
