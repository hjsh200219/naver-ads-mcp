import { createHash } from "node:crypto";

type Json = string | number | boolean | null | Json[] | { [k: string]: Json };

/**
 * Stable serialization: object keys sorted lexically, arrays preserved in
 * order. Used as input to SHA-256 so the same logical payload always hashes
 * the same regardless of property declaration order.
 */
export function canonicalizePayload(value: unknown): string {
  return JSON.stringify(canonical(value as Json));
}

function canonical(value: Json): Json {
  if (value === null) return null;
  if (Array.isArray(value)) return value.map(canonical);
  if (typeof value === "object") {
    const sorted: { [k: string]: Json } = {};
    const obj = value as { [k: string]: Json };
    for (const k of Object.keys(obj).sort()) {
      const v = obj[k];
      if (v === undefined) continue;
      sorted[k] = canonical(v);
    }
    return sorted;
  }
  return value;
}

/**
 * SHA-256 hex over `canonicalPayload + "." + minute`. Minute is the unix epoch
 * minute (seconds / 60 truncated, OR a stable integer the caller provides).
 * Using the minute makes hashes 5-min LRU friendly without leaking exact ts.
 */
export function computePayloadHash(payload: unknown, minute: number): string {
  const input = `${canonicalizePayload(payload)}.${minute}`;
  return createHash("sha256").update(input).digest("hex");
}
