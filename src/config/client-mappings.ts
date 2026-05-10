import { z } from "zod";

// Kebab-case identifier (also accepts trailing digits like client-1).
const CLIENT_ID_PATTERN = /^[a-z0-9]+(-[a-z0-9]+)*$/;

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

export interface PublicClientMapping {
  client_id: string;
  display_name: string;
  customer_id: string;
  automation_enabled: boolean;
  notes?: string;
}

export interface PublicClientMappingsPayload {
  mappings: PublicClientMapping[];
}

/**
 * Strip recipients/cc fields before exposing the mappings as an MCP resource.
 * PII minimization: the public resource payload only needs identifying labels,
 * not contact details.
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
      return out;
    }),
  };
}
