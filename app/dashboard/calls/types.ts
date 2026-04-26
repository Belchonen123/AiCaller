import { z } from "zod";

export const callRowSchema = z.object({
  id: z.uuid(),
  tenant_id: z.uuid(),
  lead_id: z.uuid().nullable(),
  retell_call_id: z.string(),
  caller_phone: z.string().nullable(),
  caller_phone_normalized: z.string().nullable(),
  call_started_at: z.string().nullable(),
  call_ended_at: z.string().nullable(),
  duration_seconds: z.number().nullable(),
  transcript: z.string().nullable(),
  recording_url: z.string().nullable(),
  disconnect_reason: z.string().nullable(),
  call_direction: z.string().nullable(),
  status: z.string(),
  extraction: z.unknown().nullable(),
  extraction_confidence: z.string().nullable(),
  manually_edited: z.boolean().nullable(),
  created_at: z.string().nullable(),
  updated_at: z.string().nullable(),
  leads: z
    .object({
      id: z.uuid(),
      lead_type: z.string(),
      lead_status: z.string(),
    })
    .nullable()
    .optional(),
});

export const callEventSchema = z.object({
  id: z.uuid(),
  event_type: z.string(),
  payload: z.unknown().nullable(),
  created_at: z.string().nullable(),
  profiles: z
    .object({
      full_name: z.string().nullable(),
      email: z.string().nullable(),
    })
    .nullable()
    .optional(),
});

export const relatedLeadSchema = z.object({
  id: z.uuid(),
  lead_type: z.string(),
  lead_status: z.string(),
  created_at: z.string().nullable(),
});

export type CallRow = z.infer<typeof callRowSchema>;
export type CallEvent = z.infer<typeof callEventSchema>;
export type RelatedLead = z.infer<typeof relatedLeadSchema>;

export type CallFilters = {
  status: string;
  confidence: string;
  linked: string;
  direction: string;
  search: string;
  from: string;
  to: string;
};
