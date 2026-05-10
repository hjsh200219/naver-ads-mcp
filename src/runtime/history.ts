// L1 runtime: weekly-prepare history JSONL. One file per (client, week).
//
// Schema is defined here (L1) — not in L4 — because history is a runtime
// audit-trail concept, not user-supplied configuration. The L4 layer is for
// inputs (env vars, JSON config); history is L1 output.

import { promises as fsp } from "node:fs";
import path from "node:path";
import { z } from "zod";
import { acquireLock } from "./lock.js";

// `week` accepts both ISO week (2026-W17) for weekly entries and yyyy-mm-dd
// for daily entries (US-020); the field is used as the filename key.
export const HistoryEntrySchema = z
  .object({
    week: z.string().regex(/^(\d{4}-W\d{2}|\d{4}-\d{2}-\d{2})$/),
    client: z
      .string()
      .min(1)
      .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/),
    payload_hash: z.string().regex(/^[0-9a-f]{64}$/),
    prepared_at: z.string().min(1),
    html_path: z.string(),
    xlsx_path: z.string(),
    status: z.enum([
      "prepared",
      "corrected_prepared",
      "prepare_failed",
      "daily_prepared",
    ]),
    violation_count: z.number().int().min(0).optional(),
  })
  .strict();

export type HistoryEntry = z.infer<typeof HistoryEntrySchema>;

export interface AppendArgs {
  baseDir: string;
  entry: HistoryEntry;
}

export interface ReadArgs {
  baseDir: string;
  client: string;
  week: string;
}

function jsonlPath(baseDir: string, client: string, week: string): string {
  return path.join(baseDir, client, `${week}.jsonl`);
}

/**
 * Append one JSONL line atomically:
 *   1. Validate the entry
 *   2. Acquire the (client, week) lock
 *   3. Read existing file (if any) → append → write to temp → rename
 *   4. Release the lock
 *
 * On schema-validation failure, NOTHING is written (the test for that is
 * `rejects invalid entry without writing the file`).
 */
export async function appendHistory({
  baseDir,
  entry,
}: AppendArgs): Promise<void> {
  const validated = HistoryEntrySchema.parse(entry);
  const dir = path.join(baseDir, validated.client);
  await fsp.mkdir(dir, { recursive: true });
  const lock = await acquireLock({
    baseDir,
    client: validated.client,
    week: validated.week,
  });
  try {
    const target = jsonlPath(baseDir, validated.client, validated.week);
    let existing = "";
    try {
      existing = await fsp.readFile(target, "utf8");
    } catch (err) {
      if (
        !(err instanceof Error) ||
        !(err as NodeJS.ErrnoException).code ||
        (err as NodeJS.ErrnoException).code !== "ENOENT"
      ) {
        throw err;
      }
    }
    const next = existing + JSON.stringify(validated) + "\n";
    const tmp = `${target}.${process.pid}.${Date.now()}.tmp`;
    await fsp.writeFile(tmp, next, "utf8");
    await fsp.rename(tmp, target);
  } finally {
    await lock.release();
  }
}

export async function readHistory({
  baseDir,
  client,
  week,
}: ReadArgs): Promise<HistoryEntry[]> {
  const target = jsonlPath(baseDir, client, week);
  let raw = "";
  try {
    raw = await fsp.readFile(target, "utf8");
  } catch (err) {
    if (
      err instanceof Error &&
      (err as NodeJS.ErrnoException).code === "ENOENT"
    ) {
      return [];
    }
    throw err;
  }
  if (raw.trim() === "") return [];
  const lines = raw.split("\n").filter((l) => l.length > 0);
  return lines.map((line) => HistoryEntrySchema.parse(JSON.parse(line)));
}
