import { describe, it, expect } from "vitest";
import { mapWithConcurrency } from "../src/util/concurrency.js";

const tick = () => new Promise((r) => setTimeout(r, 0));

describe("mapWithConcurrency", () => {
  it("returns results in input order regardless of completion order", async () => {
    const delays = [30, 0, 20, 10];
    const out = await mapWithConcurrency(delays, 4, async (d, i) => {
      await new Promise((r) => setTimeout(r, d));
      return i;
    });
    expect(out).toEqual([0, 1, 2, 3]);
  });

  it("never exceeds the concurrency cap", async () => {
    let inFlight = 0;
    let maxInFlight = 0;
    const items = Array.from({ length: 28 }, (_, i) => i);
    await mapWithConcurrency(items, 8, async (i) => {
      inFlight++;
      maxInFlight = Math.max(maxInFlight, inFlight);
      await tick();
      inFlight--;
      return i;
    });
    expect(maxInFlight).toBeLessThanOrEqual(8);
    expect(maxInFlight).toBeGreaterThan(1); // proves it actually parallelizes
  });

  it("rejects on first task failure", async () => {
    await expect(
      mapWithConcurrency([1, 2, 3], 2, async (n) => {
        if (n === 2) throw new Error("boom");
        return n;
      }),
    ).rejects.toThrow("boom");
  });

  it("handles empty input", async () => {
    expect(await mapWithConcurrency([], 8, async (n) => n)).toEqual([]);
  });

  it("caps pool at item count when limit exceeds length", async () => {
    let inFlight = 0;
    let maxInFlight = 0;
    await mapWithConcurrency([1, 2, 3], 100, async (n) => {
      inFlight++;
      maxInFlight = Math.max(maxInFlight, inFlight);
      await tick();
      inFlight--;
      return n;
    });
    expect(maxInFlight).toBeLessThanOrEqual(3);
  });
});
