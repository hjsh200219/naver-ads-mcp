import { describe, expect, it } from "vitest";
import {
  DEFAULT_DAILY_THRESHOLDS,
  ThresholdConfigSchema,
  evaluateThresholds,
  resolveThresholds,
} from "../src/analyzer/thresholds.js";

describe("DEFAULT_DAILY_THRESHOLDS", () => {
  it("matches plan-defined defaults", () => {
    expect(DEFAULT_DAILY_THRESHOLDS).toEqual({
      roas_mom_pct: -20,
      cpc_mom_pct: 30,
      impressions_dod_pct: -50,
    });
  });
});

describe("ThresholdConfigSchema", () => {
  it("accepts valid partial override", () => {
    expect(() =>
      ThresholdConfigSchema.parse({ roas_mom_pct: -25 }),
    ).not.toThrow();
  });

  it("accepts full override", () => {
    expect(() =>
      ThresholdConfigSchema.parse({
        roas_mom_pct: -10,
        cpc_mom_pct: 40,
        impressions_dod_pct: -30,
      }),
    ).not.toThrow();
  });

  it("rejects non-numeric value", () => {
    expect(() =>
      ThresholdConfigSchema.parse({ roas_mom_pct: "bad" }),
    ).toThrow();
  });

  it("rejects unknown field", () => {
    expect(() =>
      ThresholdConfigSchema.parse({
        roas_mom_pct: -20,
        unknown_field: 1,
      }),
    ).toThrow();
  });
});

describe("resolveThresholds", () => {
  it("returns defaults when override is undefined", () => {
    expect(resolveThresholds()).toEqual(DEFAULT_DAILY_THRESHOLDS);
  });

  it("override wins, missing keys fall back to default", () => {
    expect(resolveThresholds({ cpc_mom_pct: 50 })).toEqual({
      roas_mom_pct: -20,
      cpc_mom_pct: 50,
      impressions_dod_pct: -50,
    });
  });

  it("full override replaces all defaults", () => {
    expect(
      resolveThresholds({
        roas_mom_pct: -10,
        cpc_mom_pct: 10,
        impressions_dod_pct: -10,
      }),
    ).toEqual({
      roas_mom_pct: -10,
      cpc_mom_pct: 10,
      impressions_dod_pct: -10,
    });
  });
});

describe("evaluateThresholds", () => {
  const thresholds = DEFAULT_DAILY_THRESHOLDS;

  it("returns no violations when metrics within tolerance", () => {
    const violations = evaluateThresholds(
      {
        roas_mom_pct: -10,
        cpc_mom_pct: 15,
        impressions_dod_pct: -25,
      },
      thresholds,
    );
    expect(violations).toEqual([]);
  });

  it("detects roas_mom breach (worse than -20%)", () => {
    const violations = evaluateThresholds(
      {
        roas_mom_pct: -30,
        cpc_mom_pct: 0,
        impressions_dod_pct: 0,
      },
      thresholds,
    );
    expect(violations).toHaveLength(1);
    expect(violations[0]).toMatchObject({
      metric: "roas_mom",
      actual_pct: -30,
      threshold_pct: -20,
      severity: "breach",
    });
  });

  it("detects cpc_mom breach (worse than +30%)", () => {
    const violations = evaluateThresholds(
      { roas_mom_pct: 0, cpc_mom_pct: 50, impressions_dod_pct: 0 },
      thresholds,
    );
    expect(violations.map((v) => v.metric)).toEqual(["cpc_mom"]);
  });

  it("detects impressions_dod breach (worse than -50%)", () => {
    const violations = evaluateThresholds(
      { roas_mom_pct: 0, cpc_mom_pct: 0, impressions_dod_pct: -70 },
      thresholds,
    );
    expect(violations.map((v) => v.metric)).toEqual(["impressions_dod"]);
  });

  it("detects multiple breaches simultaneously", () => {
    const violations = evaluateThresholds(
      {
        roas_mom_pct: -40,
        cpc_mom_pct: 60,
        impressions_dod_pct: -80,
      },
      thresholds,
    );
    expect(violations.map((v) => v.metric).sort()).toEqual([
      "cpc_mom",
      "impressions_dod",
      "roas_mom",
    ]);
  });

  it("zero-baseline does not breach (null actual treated as no-signal)", () => {
    const violations = evaluateThresholds(
      {
        roas_mom_pct: null,
        cpc_mom_pct: null,
        impressions_dod_pct: null,
      },
      thresholds,
    );
    expect(violations).toEqual([]);
  });

  it("exact threshold boundary does not breach (strict inequality)", () => {
    const violations = evaluateThresholds(
      {
        roas_mom_pct: -20,
        cpc_mom_pct: 30,
        impressions_dod_pct: -50,
      },
      thresholds,
    );
    expect(violations).toEqual([]);
  });
});

describe("Layer rules", () => {
  it("thresholds.ts does not import node:fs (L2 purity)", async () => {
    const fs = await import("node:fs");
    const path = await import("node:path");
    const content = fs.readFileSync(
      path.resolve(__dirname, "../src/analyzer/thresholds.ts"),
      "utf8",
    );
    expect(content).not.toMatch(/from\s+["']node:fs["']/);
    expect(content).not.toMatch(/from\s+["']fs["']/);
  });
});
