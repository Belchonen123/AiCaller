import { z } from "zod";

export const leadRowSchema = z.object({
  id: z.uuid(),
  tenant_id: z.uuid(),
  lead_type: z.string(),
  lead_status: z.string(),
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
  profiles: z
    .object({
      id: z.uuid(),
      full_name: z.string().nullable(),
      email: z.string().nullable(),
    })
    .nullable()
    .optional(),
});

export const contactRowSchema = z.object({
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

export const clientRowSchema = z.record(z.string(), z.unknown()).and(
  z.object({
    lead_id: z.uuid(),
    first_name: z.string().nullable().optional(),
    last_name: z.string().nullable().optional(),
    address_city: z.string().nullable().optional(),
    primary_payer: z.string().nullable().optional(),
    adl_bathing: z.string().nullable().optional(),
    adl_dressing: z.string().nullable().optional(),
    adl_grooming: z.string().nullable().optional(),
    adl_toileting: z.string().nullable().optional(),
    adl_transferring: z.string().nullable().optional(),
    adl_eating: z.string().nullable().optional(),
  })
);

export const caregiverRowSchema = z.record(z.string(), z.unknown()).and(
  z.object({
    lead_id: z.uuid(),
  })
);

export const staffSchema = z.object({
  id: z.uuid(),
  full_name: z.string().nullable(),
  email: z.string(),
});

export type LeadRow = z.infer<typeof leadRowSchema>;
export type ContactRow = z.infer<typeof contactRowSchema>;
export type ClientRow = z.infer<typeof clientRowSchema>;
export type CaregiverRow = z.infer<typeof caregiverRowSchema>;
export type StaffRow = z.infer<typeof staffSchema>;

export type LeadListItem = LeadRow & {
  primaryContact: ContactRow | null;
  prospectiveClient: ClientRow | null;
  caregiverApplicant: CaregiverRow | null;
  contactCount: number;
  callCount: number;
  flagged: boolean;
};

export type LeadFilters = {
  leadTypes: string[];
  statuses: string[];
  statusMode: "active" | "closed" | "all";
  urgencies: string[];
  assignedTo: string;
  payers: string[];
  source: string;
  hasFlags: boolean;
  from: string;
  to: string;
  search: string;
  myLeads: boolean;
  page: number;
  pageSize: number;
};
