import { describe, it, expect } from "vitest";
import {
  computePayloadHash,
  canonicalizePayload,
} from "../src/runtime/payload-hash.js";

describe("US-014 computePayloadHash determinism (AC #19)", () => {
  it("same input + same minute → same hash", () => {
    const payload = { client: "bishef", week: "2026-W18", value: 42 };
    const minute = 1746879600;
    expect(computePayloadHash(payload, minute)).toBe(
      computePayloadHash(payload, minute),
    );
  });

  it("different minute → different hash", () => {
    const payload = { client: "bishef", week: "2026-W18" };
    const a = computePayloadHash(payload, 1746879600);
    const b = computePayloadHash(payload, 1746879660);
    expect(a).not.toBe(b);
  });

  it("returns 64-char lowercase hex (sha256)", () => {
    const hash = computePayloadHash({ a: 1 }, 0);
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
  });

  it("canonicalizePayload sorts keys deterministically", () => {
    const a = canonicalizePayload({ b: 2, a: 1, c: { y: 2, x: 1 } });
    const b = canonicalizePayload({ a: 1, c: { x: 1, y: 2 }, b: 2 });
    expect(a).toBe(b);
  });

  it("reordered keys produce identical hash", () => {
    const minute = 1746879600;
    const a = computePayloadHash({ b: 2, a: 1, c: 3 }, minute);
    const b = computePayloadHash({ c: 3, a: 1, b: 2 }, minute);
    expect(a).toBe(b);
  });

  it("array order matters (semantic difference)", () => {
    const minute = 1746879600;
    const a = computePayloadHash({ items: [1, 2, 3] }, minute);
    const b = computePayloadHash({ items: [3, 2, 1] }, minute);
    expect(a).not.toBe(b);
  });

  it("nested objects canonicalize deterministically", () => {
    const minute = 1746879600;
    const a = computePayloadHash({ outer: { z: 1, a: 2 } }, minute);
    const b = computePayloadHash({ outer: { a: 2, z: 1 } }, minute);
    expect(a).toBe(b);
  });
});
