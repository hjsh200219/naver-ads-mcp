// L1 runtime helper: writes `src/config/client-mappings.json` atomically.
// Performs read-modify-write under a sentinel lock so concurrent register_client
// calls do not clobber each other. L4 config stays node:fs-free.

import { promises as fsp } from "node:fs";
import path from "node:path";
import { lock as plLock } from "proper-lockfile";
import {
  ClientMappingSchema,
  ClientMappingsFileSchema,
  type ClientMapping,
  type ClientMappingsFile,
} from "../config/client-mappings.js";
import { defaultClientMappingsPath } from "./client-mappings-loader.js";

export class ClientMappingsWriteError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ClientMappingsWriteError";
  }
}

export interface UpsertOptions {
  filePath?: string;
  /** When true, overwrite an existing mapping with the same client_id. */
  overwrite?: boolean;
}

export interface UpsertResult {
  added: boolean;
  updated: boolean;
  mapping: ClientMapping;
}

async function readFileOrEmpty(target: string): Promise<ClientMappingsFile> {
  try {
    const raw = await fsp.readFile(target, "utf8");
    const parsed = JSON.parse(raw) as unknown;
    return ClientMappingsFileSchema.parse(parsed);
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") {
      return { mappings: [] };
    }
    throw err;
  }
}

async function atomicWriteJson(
  target: string,
  data: ClientMappingsFile,
): Promise<void> {
  const dir = path.dirname(target);
  await fsp.mkdir(dir, { recursive: true });
  const tmp = `${target}.${process.pid}.${Date.now()}.tmp`;
  const body = `${JSON.stringify(data, null, 2)}\n`;
  await fsp.writeFile(tmp, body, { encoding: "utf8", mode: 0o600 });
  await fsp.rename(tmp, target);
}

/**
 * Insert or update a single mapping. Acquires an advisory lock on a sentinel
 * file beside the target so concurrent callers serialize. Validates the merged
 * file against ClientMappingsFileSchema before writing.
 */
export async function upsertClientMapping(
  mapping: unknown,
  options: UpsertOptions = {},
): Promise<UpsertResult> {
  const validated = ClientMappingSchema.parse(mapping);
  const target = options.filePath ?? defaultClientMappingsPath();
  const lockSentinel = `${target}.lock`;
  await fsp.mkdir(path.dirname(target), { recursive: true });
  await fsp.writeFile(lockSentinel, "", { flag: "a" });
  const release = await plLock(lockSentinel, {
    retries: { retries: 20, factor: 1, minTimeout: 5, maxTimeout: 50 },
    realpath: false,
    stale: 10_000,
  });
  try {
    const current = await readFileOrEmpty(target);
    const idx = current.mappings.findIndex(
      (m) => m.client_id === validated.client_id,
    );
    let added = false;
    let updated = false;
    let next: ClientMapping[];
    if (idx >= 0) {
      if (!options.overwrite) {
        throw new ClientMappingsWriteError(
          `client_id '${validated.client_id}' already exists; pass overwrite=true to replace`,
        );
      }
      next = current.mappings.slice();
      next[idx] = validated;
      updated = true;
    } else {
      next = [...current.mappings, validated];
      added = true;
    }
    const merged = ClientMappingsFileSchema.parse({ mappings: next });
    await atomicWriteJson(target, merged);
    return { added, updated, mapping: validated };
  } finally {
    await release();
  }
}
