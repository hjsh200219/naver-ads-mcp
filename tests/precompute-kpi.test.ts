import { describe, it, expect } from "vitest";
import {
  computeRoas,
  computeCtr,
  computeCpc,
  computeCpa,
  computeCvr,
  pctDelta,
  buildKpiSummary,
  buildWowDelta,
  type RawRowLike,
} from "../src/parser/precompute-kpi.js";

describe("US-015 zero-safe computation helpers", () => {
  it("computeRoas: revenue / cost × 100", () => {
    expect(computeRoas(2_362_980, 457_614)).toBeCloseTo(516.37, 1);
  });
  it("computeRoas zero cost → 0 (not Infinity)", () => {
    expect(computeRoas(1000, 0)).toBe(0);
  });
  it("computeCtr: clicks / impressions × 100", () => {
    expect(computeCtr(699, 112_415)).toBeCloseTo(0.622, 2);
  });
  it("computeCtr zero impressions → 0", () => {
    expect(computeCtr(10, 0)).toBe(0);
  });
  it("computeCpc: cost / clicks", () => {
    expect(computeCpc(457_614, 699)).toBeCloseTo(654.67, 1);
  });
  it("computeCpc zero clicks → 0", () => {
    expect(computeCpc(457_614, 0)).toBe(0);
  });
  it("computeCpa: cost / conversions", () => {
    expect(computeCpa(457_614, 55)).toBeCloseTo(8320.25, 1);
  });
  it("computeCpa zero conversions → 0", () => {
    expect(computeCpa(457_614, 0)).toBe(0);
  });
  it("computeCvr: conversions / clicks × 100", () => {
    expect(computeCvr(55, 699)).toBeCloseTo(7.87, 1);
  });
  it("computeCvr zero clicks → 0", () => {
    expect(computeCvr(55, 0)).toBe(0);
  });
});

describe("US-015 pctDelta (week-over-week)", () => {
  it("positive delta: 130 vs 100 → +30%", () => {
    expect(pctDelta(130, 100)).toBeCloseTo(30, 4);
  });
  it("negative delta: 70 vs 100 → -30%", () => {
    expect(pctDelta(70, 100)).toBeCloseTo(-30, 4);
  });
  it("zero baseline + zero current → 0 (no change)", () => {
    expect(pctDelta(0, 0)).toBe(0);
  });
  it("zero baseline + nonzero current → 100% (degenerate but bounded)", () => {
    expect(pctDelta(50, 0)).toBe(100);
  });
});

describe("US-015 buildKpiSummary from raw row", () => {
  it("derives roas from revenue/cost when not present in row", () => {
    const row: RawRowLike = {
      impressions: 112_415,
      clicks: 699,
      cost: 457_614,
      conversions: 55,
      revenue: 2_362_980,
    };
    const out = buildKpiSummary(row);
    expect(out.roas).toBeCloseTo(516.37, 1);
    expect(out.impressions).toBe(112_415);
    expect(out.clicks).toBe(699);
    expect(out.conversions).toBe(55);
  });

  it("uses provided roas when explicit", () => {
    const row: RawRowLike = {
      impressions: 100,
      clicks: 10,
      cost: 1000,
      conversions: 1,
      revenue: 5000,
      roas: 500,
    };
    const out = buildKpiSummary(row);
    expect(out.roas).toBe(500);
  });
});

describe("US-015 buildWowDelta", () => {
  it("computes signed pct deltas across all 6 KPIs", () => {
    const cur = {
      impressions: 112_415,
      clicks: 699,
      cost: 457_614,
      conversions: 55,
      revenue: 2_362_980,
      roas: 516.37,
    };
    const prev = {
      impressions: 94_505,
      clicks: 524,
      cost: 328_172,
      conversions: 48,
      revenue: 1_789_321,
      roas: 545,
    };
    const d = buildWowDelta(cur, prev);
    expect(d.impressions_pct).toBeCloseTo(18.95, 1);
    expect(d.clicks_pct).toBeCloseTo(33.4, 1); // (699-524)/524 — sample HTML "33.97" was a doc typo
    expect(d.cost_pct).toBeCloseTo(39.44, 1);
    expect(d.conversions_pct).toBeCloseTo(14.58, 1);
    expect(d.revenue_pct).toBeCloseTo(32.06, 1);
    expect(d.roas_pct).toBeLessThan(0);
  });
});
