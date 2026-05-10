// L2 analyzer: pure daily threshold engine.
// No fs, no IO. Defaults + per-client override merge + breach evaluation.

import { z } from "zod";

export interface DailyThresholds {
  roas_mom_pct: number;
  cpc_mom_pct: number;
  impressions_dod_pct: number;
}

export const DEFAULT_DAILY_THRESHOLDS: DailyThresholds = {
  roas_mom_pct: -20,
  cpc_mom_pct: 30,
  impressions_dod_pct: -50,
};

export const ThresholdConfigSchema = z
  .object({
    roas_mom_pct: z.number().optional(),
    cpc_mom_pct: z.number().optional(),
    impressions_dod_pct: z.number().optional(),
  })
  .strict();

export type ThresholdConfig = z.infer<typeof ThresholdConfigSchema>;

export function resolveThresholds(override?: ThresholdConfig): DailyThresholds {
  return {
    roas_mom_pct:
      override?.roas_mom_pct ?? DEFAULT_DAILY_THRESHOLDS.roas_mom_pct,
    cpc_mom_pct: override?.cpc_mom_pct ?? DEFAULT_DAILY_THRESHOLDS.cpc_mom_pct,
    impressions_dod_pct:
      override?.impressions_dod_pct ??
      DEFAULT_DAILY_THRESHOLDS.impressions_dod_pct,
  };
}

export interface DailyMetrics {
  roas_mom_pct: number | null;
  cpc_mom_pct: number | null;
  impressions_dod_pct: number | null;
}

export type ThresholdMetric = "roas_mom" | "cpc_mom" | "impressions_dod";

export interface ThresholdViolation {
  metric: ThresholdMetric;
  actual_pct: number;
  threshold_pct: number;
  severity: "breach";
}

export function evaluateThresholds(
  metrics: DailyMetrics,
  thresholds: DailyThresholds,
): ThresholdViolation[] {
  const violations: ThresholdViolation[] = [];

  if (
    metrics.roas_mom_pct !== null &&
    metrics.roas_mom_pct < thresholds.roas_mom_pct
  ) {
    violations.push({
      metric: "roas_mom",
      actual_pct: metrics.roas_mom_pct,
      threshold_pct: thresholds.roas_mom_pct,
      severity: "breach",
    });
  }

  if (
    metrics.cpc_mom_pct !== null &&
    metrics.cpc_mom_pct > thresholds.cpc_mom_pct
  ) {
    violations.push({
      metric: "cpc_mom",
      actual_pct: metrics.cpc_mom_pct,
      threshold_pct: thresholds.cpc_mom_pct,
      severity: "breach",
    });
  }

  if (
    metrics.impressions_dod_pct !== null &&
    metrics.impressions_dod_pct < thresholds.impressions_dod_pct
  ) {
    violations.push({
      metric: "impressions_dod",
      actual_pct: metrics.impressions_dod_pct,
      threshold_pct: thresholds.impressions_dod_pct,
      severity: "breach",
    });
  }

  return violations;
}
