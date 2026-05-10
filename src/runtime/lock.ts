// L1 runtime helper: per-(client, week) advisory file lock backed by
// proper-lockfile. Used by history.ts and (Phase 3) the prepare flow to
// serialize concurrent prepare calls for the same logical work unit.

import { lock as plLock } from "proper-lockfile";
import { promises as fsp } from "node:fs";
import path from "node:path";

export interface LockHandle {
  release(): Promise<void>;
}

export interface AcquireOptions {
  baseDir: string;
  client: string;
  week: string;
  retries?: number;
}

/**
 * Acquire an exclusive lock for (client, week). The lock is implemented by
 * proper-lockfile against a sentinel file inside `<baseDir>/<client>/.locks/`.
 * Sentinel is auto-created if missing. Caller MUST call release().
 */
export async function acquireLock({
  baseDir,
  client,
  week,
  retries = 50,
}: AcquireOptions): Promise<LockHandle> {
  const lockDir = path.join(baseDir, client, ".locks");
  await fsp.mkdir(lockDir, { recursive: true });
  const sentinel = path.join(lockDir, `${week}.sentinel`);
  // Touch the sentinel so proper-lockfile has a target.
  await fsp.writeFile(sentinel, "", { flag: "a" });
  const release = await plLock(sentinel, {
    retries: { retries, factor: 1, minTimeout: 5, maxTimeout: 50 },
    realpath: false,
    stale: 30_000,
  });
  return {
    release: async () => {
      await release();
    },
  };
}
