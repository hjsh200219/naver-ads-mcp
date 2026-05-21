import { afterEach, describe, expect, it } from "vitest";
import { ensureDefaultTimezone } from "../src/runtime/timezone.js";

const ORIGINAL_TZ = process.env.TZ;

afterEach(() => {
  if (ORIGINAL_TZ === undefined) {
    delete process.env.TZ;
  } else {
    process.env.TZ = ORIGINAL_TZ;
  }
});

describe("ensureDefaultTimezone", () => {
  it("defaults TZ to Asia/Seoul when unset", () => {
    delete process.env.TZ;

    ensureDefaultTimezone();

    expect(process.env.TZ).toBe("Asia/Seoul");
  });

  it("does not override an explicitly configured TZ", () => {
    process.env.TZ = "UTC";

    ensureDefaultTimezone();

    expect(process.env.TZ).toBe("UTC");
  });
});
