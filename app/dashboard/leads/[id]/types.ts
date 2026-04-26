import { z } from "zod";
import { leadStatuses, leadTypes } from "@/app/dashboard/leads/[id]/lead-config";

export const leadSchema = z.object({
  id: z.uuid(),
  tenant_id: z.uuid(),
  lead_type: z.enum(leadTypes),
  lead_status: z.enum(leadStatuses),
  source: z.string().nullable(),
  referral_partner_name: z.string().nullable(),
  urgency: z.string().nullable(),
  assigned_to: z.uuid().nullable(),
  next_followup_at: z.string().nullable(),
  first_contact_at: z.string().nullable(),
  last_contact_at: z.string().nullable(),
  disqualified_reason: z.string().nullable(),
  notes: z.string().nullable(),
  created_at: z.string().nullable(),
  updated_at: z.string().nullable(),
});

export const profileOptionSchema = z.object({
  id: z.uuid(),
  full_name: z.string().nullable(),
  email: z.string(),
  role: z.string(),
});

export const recordSchema = z.record(z.string(), z.unknown()).nullable();

export const contactSchema = z.object({
  id: z.uuid(),
  lead_id: z.uuid(),
  full_name: z.string().nullable(),
  phone: z.string().nullable(),
  phone_alt: z.string().nullable(),
  email: z.string().nullable(),
  relationship_to_client: z.string().nullable(),
  is_primary_contact: z.boolean().nullable(),
  is_poa: z.boolean().nullable(),
  is_emergency_contact: z.boolean().nullable(),
  preferred_contact_method: z.string().nullable(),
  best_time_to_reach: z.string().nullable(),
  notes: z.string().nullable(),
  created_at: z.string().nullable(),
});

export const intakeCallSchema = z.object({
  id: z.uuid(),
  retell_call_id: z.string(),
  call_started_at: z.string().nullable(),
  call_ended_at: z.string().nullable(),
  duration_seconds: z.number().nullable(),
  transcript: z.string().nullable(),
  recording_url: z.string().nullable(),
  extraction: z.unknown().nullable(),
  extraction_confidence: z.string().nullable(),
  created_at: z.string().nullable(),
});

export const activitySchema = z.object({
  id: z.uuid(),
  activity_type: z.string(),
  summary: z.string(),
  detail: z.unknown().nullable(),
  created_at: z.string().nullable(),
  profiles: z
    .object({
      full_name: z.string().nullable(),
      email: z.string().nullable(),
    })
    .nullable()
    .optional(),
});

export type Lead = z.infer<typeof leadSchema>;
export type ProfileOption = z.infer<typeof profileOptionSchema>;
export type Contact = z.infer<typeof contactSchema>;
export type IntakeCall = z.infer<typeof intakeCallSchema>;
export type Activity = z.infer<typeof activitySchema>;
export type DetailRecord = Record<string, unknown>;

export type LeadDetailData = {
  lead: Lead;
  staff: ProfileOption[];
  prospectiveClient: DetailRecord | null;
  caregiverApplicant: DetailRecord | null;
  contacts: Contact[];
  calls: IntakeCall[];
  activities: Activity[];
  flags: Activity[];
  relatedLeads: Pick<Lead, "id" | "lead_type" | "lead_status" | "created_at">[];
};
