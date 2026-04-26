"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import {
  caregiverStatuses,
  leadStatuses,
  statusTransitions,
} from "@/app/dashboard/leads/[id]/lead-config";
import { activitySchema } from "@/app/dashboard/leads/[id]/types";
import { getCurrentUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

const leadFieldSchema = z.enum([
  "source",
  "referral_partner_name",
  "urgency",
  "assigned_to",
  "next_followup_at",
  "notes",
]);

const prospectiveClientFieldSchema = z.enum([
  "first_name",
  "last_name",
  "preferred_name",
  "date_of_birth",
  "age",
  "gender",
  "marital_status",
  "primary_language",
  "requires_interpreter",
  "interpreter_language",
  "ethnicity",
  "veteran_status",
  "address_street",
  "address_unit",
  "address_city",
  "address_state",
  "address_zip",
  "county",
  "lives_with",
  "home_type",
  "stairs_to_enter",
  "pets_in_home",
  "smoking_in_home",
  "home_safety_concerns",
  "medicaid_id",
  "medicare_id",
  "ssn_last4",
  "ss_benefits_receiving",
  "has_pcp",
  "pcp_name",
  "pcp_phone",
  "pcp_practice",
  "recent_hospitalization",
  "recent_hospitalization_detail",
  "primary_payer",
  "mco_plan_name",
  "medicaid_active",
  "medicaid_pending",
  "has_mi_choice_waiver",
  "has_medicare_advantage",
  "ltc_policy_carrier",
  "va_benefits",
  "estimated_monthly_budget_private_pay",
  "adl_bathing",
  "adl_dressing",
  "adl_grooming",
  "adl_toileting",
  "adl_transferring",
  "adl_eating",
  "continence_bladder",
  "continence_bowel",
  "iadl_meal_prep",
  "iadl_light_housework",
  "iadl_laundry",
  "iadl_shopping",
  "iadl_medication_reminders",
  "iadl_transportation",
  "mobility_status",
  "uses_oxygen",
  "fall_risk",
  "falls_last_90_days",
  "medical_equipment",
  "cognitive_status",
  "has_dementia_diagnosis",
  "behavioral_concerns",
  "mental_health_history",
  "primary_diagnosis",
  "secondary_diagnoses",
  "medications_count",
  "medication_list",
  "requested_services",
  "requested_hours_per_week",
  "requested_start_date",
  "preferred_schedule",
  "preferred_caregiver_gender",
  "preferred_caregiver_language",
  "caregiver_notes",
  "family_caregiver_available",
  "family_caregiver_relationship",
  "family_caregiver_wants_to_be_paid",
  "currently_receiving_services",
  "current_agency_name",
  "reason_for_change",
]);

const caregiverApplicantFieldSchema = z.enum([
  "first_name",
  "last_name",
  "phone",
  "email",
  "address_city",
  "address_state",
  "address_zip",
  "date_of_birth",
  "has_drivers_license",
  "has_reliable_transportation",
  "willing_to_travel_miles",
  "years_experience",
  "experience_types",
  "cna_certified",
  "hha_certified",
  "cpr_certified",
  "first_aid_certified",
  "languages_spoken",
  "hours_per_week_sought",
  "availability",
  "has_been_in_champs",
  "willing_to_enroll_in_champs",
  "referred_by",
  "relationship_to_prospective_client",
  "willing_background_check",
  "status",
  "notes",
]);

const contactFieldSchema = z.enum([
  "full_name",
  "phone",
  "phone_alt",
  "email",
  "relationship_to_client",
  "is_primary_contact",
  "is_poa",
  "is_emergency_contact",
  "preferred_contact_method",
  "best_time_to_reach",
  "notes",
]);

const serializableValueSchema = z.union([
  z.string(),
  z.number(),
  z.boolean(),
  z.array(z.string()),
  z.null(),
]);

const leadIdSchema = z.uuid();

export type MutationResult = {
  ok: boolean;
  message: string;
};

async function insertActivity(params: {
  leadId: string;
  tenantId: string;
  activityType:
    | "status_change"
    | "note"
    | "assignment"
    | "field_updated"
    | "flagged"
    | "merged";
  summary: string;
  detail?: Record<string, unknown>;
}) {
  const supabase = await createClient();
  const { profile } = await getCurrentUser();

  const { error } = await supabase.from("lead_activities").insert({
    tenant_id: params.tenantId,
    lead_id: params.leadId,
    activity_type: params.activityType,
    summary: params.summary,
    detail: params.detail ?? null,
    created_by: profile.id,
  });

  if (error) {
    throw new Error("Unable to record activity");
  }
}

async function requireLead(leadId: string) {
  const supabase = await createClient();
  const { profile } = await getCurrentUser();
  const { data, error } = await supabase
    .from("leads")
    .select("id, tenant_id, lead_status, lead_type")
    .eq("id", leadId)
    .eq("tenant_id", profile.tenant_id)
    .single();

  if (error || !data) {
    throw new Error("Lead not found");
  }

  return data;
}

function normalizeValue(value: z.infer<typeof serializableValueSchema>) {
  if (typeof value === "string" && value.trim() === "") {
    return null;
  }

  return value;
}

export async function updateLeadStatus(input: {
  leadId: string;
  status: string;
  note?: string;
}): Promise<MutationResult> {
  const parsed = z
    .object({
      leadId: leadIdSchema,
      status: z.enum(leadStatuses),
      note: z.string().trim().max(1000).optional(),
    })
    .safeParse(input);

  if (!parsed.success) {
    return { ok: false, message: "Invalid status update." };
  }

  const supabase = await createClient();
  const lead = await requireLead(parsed.data.leadId);
  const allowed = statusTransitions[lead.lead_status as keyof typeof statusTransitions];

  if (!allowed.includes(parsed.data.status)) {
    return { ok: false, message: "That status transition is not allowed." };
  }

  const { error } = await supabase
    .from("leads")
    .update({ lead_status: parsed.data.status })
    .eq("id", parsed.data.leadId)
    .eq("tenant_id", lead.tenant_id);

  if (error) {
    return { ok: false, message: "Unable to update status." };
  }

  if (parsed.data.note) {
    await insertActivity({
      leadId: parsed.data.leadId,
      tenantId: lead.tenant_id,
      activityType: "note",
      summary: "Status note added",
      detail: { note: parsed.data.note },
    });
  }

  revalidatePath(`/dashboard/leads/${parsed.data.leadId}`);
  return { ok: true, message: "Status updated." };
}

export async function archiveLead(input: {
  leadId: string;
}): Promise<MutationResult> {
  const parsed = z.object({ leadId: leadIdSchema }).safeParse(input);

  if (!parsed.success) {
    return { ok: false, message: "Invalid lead." };
  }

  const supabase = await createClient();
  const lead = await requireLead(parsed.data.leadId);
  const { error } = await supabase
    .from("leads")
    .update({ lead_status: "lost" })
    .eq("id", parsed.data.leadId)
    .eq("tenant_id", lead.tenant_id);

  if (error) {
    return { ok: false, message: "Unable to archive lead." };
  }

  await insertActivity({
    leadId: parsed.data.leadId,
    tenantId: lead.tenant_id,
    activityType: "status_change",
    summary: "Lead archived",
  });

  revalidatePath(`/dashboard/leads/${parsed.data.leadId}`);
  return { ok: true, message: "Lead archived." };
}

export async function updateLeadField(input: {
  leadId: string;
  field: string;
  value: z.infer<typeof serializableValueSchema>;
}): Promise<MutationResult> {
  const parsed = z
    .object({
      leadId: leadIdSchema,
      field: leadFieldSchema,
      value: serializableValueSchema,
    })
    .safeParse(input);

  if (!parsed.success) {
    return { ok: false, message: "Invalid lead field." };
  }

  const supabase = await createClient();
  const lead = await requireLead(parsed.data.leadId);
  const nextValue = normalizeValue(parsed.data.value);
  const { error } = await supabase
    .from("leads")
    .update({ [parsed.data.field]: nextValue })
    .eq("id", parsed.data.leadId)
    .eq("tenant_id", lead.tenant_id);

  if (error) {
    return { ok: false, message: "Unable to save lead field." };
  }

  await insertActivity({
    leadId: parsed.data.leadId,
    tenantId: lead.tenant_id,
    activityType:
      parsed.data.field === "assigned_to" ? "assignment" : "field_updated",
    summary:
      parsed.data.field === "notes"
        ? "Lead notes saved"
        : `Updated leads.${parsed.data.field}`,
    detail: { field: parsed.data.field },
  });

  revalidatePath(`/dashboard/leads/${parsed.data.leadId}`);
  return { ok: true, message: "Saved." };
}

export async function addNote(input: {
  leadId: string;
  note: string;
}): Promise<MutationResult> {
  const parsed = z
    .object({
      leadId: leadIdSchema,
      note: z.string().trim().min(1).max(4000),
    })
    .safeParse(input);

  if (!parsed.success) {
    return { ok: false, message: "Note is required." };
  }

  const lead = await requireLead(parsed.data.leadId);
  await insertActivity({
    leadId: parsed.data.leadId,
    tenantId: lead.tenant_id,
    activityType: "note",
    summary: parsed.data.note,
    detail: { note: parsed.data.note },
  });

  revalidatePath(`/dashboard/leads/${parsed.data.leadId}`);
  return { ok: true, message: "Note saved." };
}

export async function updateProspectiveClientField(input: {
  leadId: string;
  field: string;
  value: z.infer<typeof serializableValueSchema>;
}): Promise<MutationResult> {
  const parsed = z
    .object({
      leadId: leadIdSchema,
      field: prospectiveClientFieldSchema,
      value: serializableValueSchema,
    })
    .safeParse(input);

  if (!parsed.success) {
    return { ok: false, message: "Invalid intake field." };
  }

  const supabase = await createClient();
  const lead = await requireLead(parsed.data.leadId);
  const { error } = await supabase.from("prospective_clients").upsert(
    {
      lead_id: parsed.data.leadId,
      tenant_id: lead.tenant_id,
      [parsed.data.field]: normalizeValue(parsed.data.value),
    },
    { onConflict: "lead_id" }
  );

  if (error) {
    return { ok: false, message: "Unable to save intake field." };
  }

  await insertActivity({
    leadId: parsed.data.leadId,
    tenantId: lead.tenant_id,
    activityType: "field_updated",
    summary: `Updated prospective_clients.${parsed.data.field}`,
    detail: { field: parsed.data.field },
  });

  revalidatePath(`/dashboard/leads/${parsed.data.leadId}`);
  return { ok: true, message: "Saved." };
}

export async function updateCaregiverApplicantField(input: {
  leadId: string;
  field: string;
  value: z.infer<typeof serializableValueSchema>;
}): Promise<MutationResult> {
  const parsed = z
    .object({
      leadId: leadIdSchema,
      field: caregiverApplicantFieldSchema,
      value: serializableValueSchema,
    })
    .safeParse(input);

  if (!parsed.success) {
    return { ok: false, message: "Invalid caregiver field." };
  }

  if (parsed.data.field === "status") {
    const status = caregiverStatuses.find((item) => item === parsed.data.value);
    if (!status) {
      return { ok: false, message: "Invalid caregiver status." };
    }
  }

  const supabase = await createClient();
  const lead = await requireLead(parsed.data.leadId);
  const { error } = await supabase.from("caregiver_applicants").upsert(
    {
      lead_id: parsed.data.leadId,
      tenant_id: lead.tenant_id,
      [parsed.data.field]: normalizeValue(parsed.data.value),
    },
    { onConflict: "lead_id" }
  );

  if (error) {
    return { ok: false, message: "Unable to save caregiver field." };
  }

  await insertActivity({
    leadId: parsed.data.leadId,
    tenantId: lead.tenant_id,
    activityType: "field_updated",
    summary: `Updated caregiver_applicants.${parsed.data.field}`,
    detail: { field: parsed.data.field },
  });

  revalidatePath(`/dashboard/leads/${parsed.data.leadId}`);
  return { ok: true, message: "Saved." };
}

export async function addFlag(input: {
  leadId: string;
  label: string;
}): Promise<MutationResult> {
  const parsed = z
    .object({
      leadId: leadIdSchema,
      label: z.string().trim().min(1).max(80),
    })
    .safeParse(input);

  if (!parsed.success) {
    return { ok: false, message: "Flag text is required." };
  }

  const lead = await requireLead(parsed.data.leadId);
  await insertActivity({
    leadId: parsed.data.leadId,
    tenantId: lead.tenant_id,
    activityType: "flagged",
    summary: parsed.data.label,
  });

  revalidatePath(`/dashboard/leads/${parsed.data.leadId}`);
  return { ok: true, message: "Flag added." };
}

export async function addContact(input: {
  leadId: string;
  fullName: string;
  phone?: string;
  relationship?: string;
}): Promise<MutationResult> {
  const parsed = z
    .object({
      leadId: leadIdSchema,
      fullName: z.string().trim().min(1).max(160),
      phone: z.string().trim().max(40).optional(),
      relationship: z.string().trim().max(80).optional(),
    })
    .safeParse(input);

  if (!parsed.success) {
    return { ok: false, message: "Contact name is required." };
  }

  const supabase = await createClient();
  const lead = await requireLead(parsed.data.leadId);
  const { error } = await supabase.from("contacts").insert({
    tenant_id: lead.tenant_id,
    lead_id: parsed.data.leadId,
    full_name: parsed.data.fullName,
    phone: parsed.data.phone || null,
    relationship_to_client: parsed.data.relationship || null,
  });

  if (error) {
    return { ok: false, message: "Unable to add contact." };
  }

  await insertActivity({
    leadId: parsed.data.leadId,
    tenantId: lead.tenant_id,
    activityType: "field_updated",
    summary: "Added contact",
  });

  revalidatePath(`/dashboard/leads/${parsed.data.leadId}`);
  return { ok: true, message: "Contact added." };
}

export async function updateContactField(input: {
  leadId: string;
  contactId: string;
  field: string;
  value: z.infer<typeof serializableValueSchema>;
}): Promise<MutationResult> {
  const parsed = z
    .object({
      leadId: leadIdSchema,
      contactId: z.uuid(),
      field: contactFieldSchema,
      value: serializableValueSchema,
    })
    .safeParse(input);

  if (!parsed.success) {
    return { ok: false, message: "Invalid contact field." };
  }

  const supabase = await createClient();
  const lead = await requireLead(parsed.data.leadId);
  const { error } = await supabase
    .from("contacts")
    .update({ [parsed.data.field]: normalizeValue(parsed.data.value) })
    .eq("id", parsed.data.contactId)
    .eq("tenant_id", lead.tenant_id)
    .eq("lead_id", parsed.data.leadId);

  if (error) {
    return { ok: false, message: "Unable to save contact." };
  }

  await insertActivity({
    leadId: parsed.data.leadId,
    tenantId: lead.tenant_id,
    activityType: "field_updated",
    summary: `Updated contacts.${parsed.data.field}`,
    detail: { field: parsed.data.field },
  });

  revalidatePath(`/dashboard/leads/${parsed.data.leadId}`);
  return { ok: true, message: "Saved." };
}

export async function relinkCall(input: {
  leadId: string;
  callId: string;
  targetLeadId: string;
}): Promise<MutationResult> {
  const parsed = z
    .object({
      leadId: leadIdSchema,
      callId: z.uuid(),
      targetLeadId: z.uuid(),
    })
    .safeParse(input);

  if (!parsed.success) {
    return { ok: false, message: "Invalid relink request." };
  }

  const supabase = await createClient();
  const currentLead = await requireLead(parsed.data.leadId);
  const targetLead = await requireLead(parsed.data.targetLeadId);

  if (currentLead.tenant_id !== targetLead.tenant_id) {
    return { ok: false, message: "Invalid target lead." };
  }

  const { error } = await supabase
    .from("intake_calls")
    .update({ lead_id: parsed.data.targetLeadId })
    .eq("id", parsed.data.callId)
    .eq("tenant_id", currentLead.tenant_id);

  if (error) {
    return { ok: false, message: "Unable to relink call." };
  }

  await insertActivity({
    leadId: parsed.data.leadId,
    tenantId: currentLead.tenant_id,
    activityType: "merged",
    summary: "Call relinked to another lead",
    detail: { call_id: parsed.data.callId, target_lead_id: parsed.data.targetLeadId },
  });

  await insertActivity({
    leadId: parsed.data.targetLeadId,
    tenantId: targetLead.tenant_id,
    activityType: "merged",
    summary: "Call linked from another lead",
    detail: { call_id: parsed.data.callId, source_lead_id: parsed.data.leadId },
  });

  revalidatePath(`/dashboard/leads/${parsed.data.leadId}`);
  revalidatePath(`/dashboard/leads/${parsed.data.targetLeadId}`);
  return { ok: true, message: "Call relinked." };
}

export async function markIntakeComplete(input: {
  leadId: string;
}): Promise<MutationResult> {
  const parsed = z.object({ leadId: leadIdSchema }).safeParse(input);

  if (!parsed.success) {
    return { ok: false, message: "Invalid lead." };
  }

  const supabase = await createClient();
  const lead = await requireLead(parsed.data.leadId);
  const nextStatus =
    lead.lead_status === "new" || lead.lead_status === "contacted"
      ? "info_gathering"
      : "pending_eligibility";

  const { error } = await supabase
    .from("leads")
    .update({ lead_status: nextStatus })
    .eq("id", parsed.data.leadId)
    .eq("tenant_id", lead.tenant_id);

  if (error) {
    return { ok: false, message: "Unable to mark intake complete." };
  }

  revalidatePath(`/dashboard/leads/${parsed.data.leadId}`);
  return { ok: true, message: "Intake marked complete." };
}

export async function loadMoreActivities(input: {
  leadId: string;
  offset: number;
}) {
  const parsed = z
    .object({
      leadId: leadIdSchema,
      offset: z.number().int().min(0),
    })
    .safeParse(input);

  if (!parsed.success) {
    return [];
  }

  const supabase = await createClient();
  const lead = await requireLead(parsed.data.leadId);
  const { data } = await supabase
    .from("lead_activities")
    .select("id, activity_type, summary, detail, created_at, profiles(full_name, email)")
    .eq("lead_id", parsed.data.leadId)
    .eq("tenant_id", lead.tenant_id)
    .order("created_at", { ascending: false })
    .range(parsed.data.offset, parsed.data.offset + 49);

  const parsedData = z.array(activitySchema).safeParse(data ?? []);

  return parsedData.success ? parsedData.data : [];
}
