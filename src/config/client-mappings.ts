import { z } from "zod";

// Kebab-case identifier (also accepts trailing digits like client-1).
const CLIENT_ID_PATTERN = /^[a-z0-9]+(-[a-z0-9]+)*$/;

// Mirror of L2 analyzer/thresholds.ts ThresholdConfigSchema. Duplicated here
// (not imported) because L4 config must not depend on L2 service code; the
// schema is small and the 3 field names are stable contract values.
const DailyThresholdsConfigSchema = z
  .object({
    roas_mom_pct: z.number().optional(),
    cpc_mom_pct: z.number().optional(),
    impressions_dod_pct: z.number().optional(),
  })
  .strict();

export const ClientMappingSchema = z
  .object({
    client_id: z
      .string()
      .min(1)
      .regex(CLIENT_ID_PATTERN, "client_id must be kebab-case"),
    display_name: z.string().min(1),
    customer_id: z.string().min(1),
    recipients: z.array(z.string()),
    cc: z.array(z.string()),
    automation_enabled: z.boolean().default(true),
    notes: z.string().optional(),
    daily_thresholds: DailyThresholdsConfigSchema.optional(),
  })
  .strict();

export type ClientMapping = z.infer<typeof ClientMappingSchema>;

export const ClientMappingsFileSchema = z
  .object({
    mappings: z.array(ClientMappingSchema),
  })
  .strict()
  .superRefine((data, ctx) => {
    const seen = new Set<string>();
    for (const m of data.mappings) {
      if (seen.has(m.client_id)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Duplicate client_id: ${m.client_id}`,
          path: ["mappings"],
        });
        return;
      }
      seen.add(m.client_id);
    }
  });

export type ClientMappingsFile = z.infer<typeof ClientMappingsFileSchema>;

export type DailyThresholdsConfig = z.infer<typeof DailyThresholdsConfigSchema>;

export interface PublicClientMapping {
  client_id: string;
  display_name: string;
  customer_id: string;
  automation_enabled: boolean;
  notes?: string;
  daily_thresholds?: DailyThresholdsConfig;
}

export interface PublicClientMappingsPayload {
  mappings: PublicClientMapping[];
}

/**
 * Strip recipients/cc fields before exposing the mappings as an MCP resource.
 * PII minimization: the public resource payload only needs identifying labels,
 * not contact details. daily_thresholds is configuration (not PII) and is
 * preserved so operators can see active overrides.
 */
export function toPublicResourcePayload(
  data: ClientMappingsFile,
): PublicClientMappingsPayload {
  return {
    mappings: data.mappings.map((m) => {
      const out: PublicClientMapping = {
        client_id: m.client_id,
        display_name: m.display_name,
        customer_id: m.customer_id,
        automation_enabled: m.automation_enabled,
      };
      if (m.notes !== undefined) {
        out.notes = m.notes;
      }
      if (m.daily_thresholds !== undefined) {
        out.daily_thresholds = m.daily_thresholds;
      }
      return out;
    }),
  };
}
