// L2 service: pure KPI computation from raw rows. The AI is forbidden to
// recompute these — it can only cite the values produced here. Zero-safe
// division is critical (avoids NaN/Infinity in artifacts).

import type { KpiSummary, WowDelta } from "./types.js";

export interface RawRowLike {
  impressions: number;
  clicks: number;
  cost: number;
  conversions: number;
  revenue: number;
  roas?: number;
}

export function computeRoas(revenue: number, cost: number): number {
  if (cost === 0) return 0;
  return (revenue / cost) * 100;
}

export function computeCtr(clicks: number, impressions: number): number {
  if (impressions === 0) return 0;
  return (clicks / impressions) * 100;
}

export function computeCpc(cost: number, clicks: number): number {
  if (clicks === 0) return 0;
  return cost / clicks;
}

export function computeCpa(cost: number, conversions: number): number {
  if (conversions === 0) return 0;
  return cost / conversions;
}

export function computeCvr(conversions: number, clicks: number): number {
  if (clicks === 0) return 0;
  return (conversions / clicks) * 100;
}

/**
 * Signed percentage delta between current and prev. Bounded for the degenerate
 * "0 → nonzero" case so the artifact does not need to render Infinity.
 */
export function pctDelta(current: number, prev: number): number {
  if (prev === 0) {
    if (current === 0) return 0;
    return 100;
  }
  return ((current - prev) / prev) * 100;
}

export function buildKpiSummary(row: RawRowLike): KpiSummary {
  return {
    impressions: row.impressions,
    clicks: row.clicks,
    cost: row.cost,
    conversions: row.conversions,
    revenue: row.revenue,
    roas: row.roas ?? computeRoas(row.revenue, row.cost),
  };
}

export function buildWowDelta(
  current: KpiSummary,
  previous: KpiSummary,
): WowDelta {
  return {
    impressions_pct: pctDelta(current.impressions, previous.impressions),
    clicks_pct: pctDelta(current.clicks, previous.clicks),
    cost_pct: pctDelta(current.cost, previous.cost),
    conversions_pct: pctDelta(current.conversions, previous.conversions),
    revenue_pct: pctDelta(current.revenue, previous.revenue),
    roas_pct: pctDelta(current.roas, previous.roas),
  };
}
