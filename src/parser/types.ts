// L5 types: standard KPI shapes used across parser, analyzer, dashboard, output.
//
// All numeric values are precomputed by the parser. The host LLM may only cite
// values from these fields — it must not recompute. This is the host LLM input
// contract.

import { z } from "zod";

/** Subset that maps to the 6 KPI cards in the sample HTML. */
export const KpiSummarySchema = z
  .object({
    impressions: z.number(),
    clicks: z.number(),
    cost: z.number(),
    conversions: z.number(),
    revenue: z.number(),
    roas: z.number(),
  })
  .strict();
export type KpiSummary = z.infer<typeof KpiSummarySchema>;

/** Per-device row inside a media (PowerLink / Shopping) breakdown. */
export const DeviceRowSchema = z
  .object({
    device: z.enum(["TOTAL", "PC", "MO"]),
    impressions: z.number(),
    clicks: z.number(),
    cost: z.number(),
    conversions: z.number(),
    revenue: z.number(),
    roas: z.number(),
  })
  .strict();
export type DeviceRow = z.infer<typeof DeviceRowSchema>;

/** Week-over-week deltas (signed percentages, not ratios) for one media. */
export const WowDeltaSchema = z
  .object({
    impressions_pct: z.number(),
    clicks_pct: z.number(),
    cost_pct: z.number(),
    conversions_pct: z.number(),
    revenue_pct: z.number(),
    roas_pct: z.number(),
  })
  .strict();
export type WowDelta = z.infer<typeof WowDeltaSchema>;

export const MediaBlockSchema = z
  .object({
    media: z.enum(["powerlink", "shopping"]),
    label: z.string(),
    rows: z.array(DeviceRowSchema),
    wow: WowDeltaSchema,
  })
  .strict();
export type MediaBlock = z.infer<typeof MediaBlockSchema>;

/** The full payload sent to the host LLM. Sourced from precompute-kpi.ts. */
export const PrecomputedPayloadSchema = z
  .object({
    advertiser: z.string(),
    industry: z.string().optional(),
    report_period: z.object({ start: z.string(), end: z.string() }).strict(),
    compare_period: z.object({ start: z.string(), end: z.string() }).strict(),
    kpi_current: KpiSummarySchema,
    kpi_previous: KpiSummarySchema,
    kpi_wow: WowDeltaSchema,
    media: z.array(MediaBlockSchema),
    monthly_budget: z
      .object({
        powerlink_budget: z.number().optional(),
        powerlink_spent_pct: z.number().optional(),
        shopping_budget: z.number().optional(),
        shopping_spent_pct: z.number().optional(),
        period_progress_pct: z.number().optional(),
      })
      .strict()
      .optional(),
    data_warnings: z.array(z.string()),
  })
  .strict();
export type PrecomputedPayload = z.infer<typeof PrecomputedPayloadSchema>;

// ---------------------------------------------------------------------------
// AI output shapes
// ---------------------------------------------------------------------------

export const InsightTypeSchema = z.enum(["good", "warn", "bad", "info"]);
export type InsightType = z.infer<typeof InsightTypeSchema>;

export const InsightSchema = z
  .object({
    type: InsightTypeSchema,
    title: z.string(),
    body: z.string(),
    metrics: z.array(z.string()),
  })
  .strict();
export type Insight = z.infer<typeof InsightSchema>;

export const ActionPrioritySchema = z.enum(["high", "mid", "low"]);
export type ActionPriority = z.infer<typeof ActionPrioritySchema>;

export const ActionItemSchema = z
  .object({
    title: z.string(),
    description: z.string(),
    priority: ActionPrioritySchema,
  })
  .strict();
export type ActionItem = z.infer<typeof ActionItemSchema>;

export const AiAnalysisSchema = z
  .object({
    review_text: z.string(),
    insights: z.array(InsightSchema).max(8),
    action_items: z.array(ActionItemSchema).max(8),
    confidence: z.number().min(0).max(1),
    data_warnings: z.array(z.string()),
  })
  .strict();
export type AiAnalysis = z.infer<typeof AiAnalysisSchema>;

/** What prepare_weekly_dashboard returns to the MCP caller. */
export const PrepareResultSchema = z
  .object({
    artifact_html: z.string(),
    html_path: z.string(),
    xlsx_path: z.string(),
    payload_hash: z.string(),
    data_warnings: z.array(z.string()),
  })
  .strict();
export type PrepareResult = z.infer<typeof PrepareResultSchema>;
