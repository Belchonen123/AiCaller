"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import { normalizePhone } from "@/lib/phone";
import { createClient } from "@/lib/supabase/server";

const leadIdSchema = z.uuid();

const manualLeadSchema = z.object({
  leadType: z.enum(["client_referral", "caregiver_applicant", "existing_client", "other"]),
  contactName: z.string().trim().min(1),
  contactPhone: z.string().trim().optional(),
  contactEmail: z.string().trim().email().optional().or(z.literal("")),
  clientFirstName: z.string().trim().optional(),
  clientLastName: z.string().trim().optional(),
  clientCity: z.string().trim().optional(),
});

export type LeadActionResult = {
  ok: boolean;
  message: string;
  leadId?: string;
};

async function insertActivity(params: {
  tenantId: string;
  leadId: string;
  activityType: "assignment" | "status_change" | "flagged" | "field_updated";
  summary: string;
  detail?: Record<string, unknown>;
}) {
  const supabase = await createClient();
  const { profile } = await getCurrentUser();

  await supabase.from("lead_activities").insert({
    tenant_id: params.tenantId,
    lead_id: params.leadId,
    activity_type: params.activityType,
    summary: params.summary,
    detail: params.detail ?? null,
    created_by: profile.id,
  });
}

async function requireLead(leadId: string) {
  const supabase = await createClient();
  const { profile } = await getCurrentUser();
  const { data, error } = await supabase
    .from("leads")
    .select("id, tenant_id, assigned_to, lead_status")
    .eq("id", leadId)
    .eq("tenant_id", profile.tenant_id)
    .single();

  if (error || !data) {
    throw new Error("Lead not found");
  }

  return { lead: data, profile };
}

export async function createManualLead(input: unknown): Promise<LeadActionResult> {
  const parsed = manualLeadSchema.safeParse(input);

  if (!parsed.success) {
    return { ok: false, message: "Required fields are missing." };
  }

  const supabase = await createClient();
  const { profile } = await getCurrentUser();
  const { data: lead, error: leadError } = await supabase
    .from("leads")
    .insert({
      tenant_id: profile.tenant_id,
      lead_type: parsed.data.leadType,
      lead_status: "new",
      source: "other",
      first_contact_at: new Date().toISOString(),
      last_contact_at: new Date().toISOString(),
    })
    .select("id")
    .single();

  if (leadError || !lead) {
    return { ok: false, message: "Unable to create lead." };
  }

  await supabase.from("contacts").insert({
    tenant_id: profile.tenant_id,
    lead_id: lead.id,
    full_name: parsed.data.contactName,
    phone: parsed.data.contactPhone
      ? normalizePhone(parsed.data.contactPhone) ?? parsed.data.contactPhone
      : null,
    email: parsed.data.contactEmail || null,
    is_primary_contact: true,
  });

  if (
    parsed.data.leadType === "client_referral" ||
    parsed.data.leadType === "existing_client"
  ) {
    await supabase.from("prospective_clients").insert({
      tenant_id: profile.tenant_id,
      lead_id: lead.id,
      first_name: parsed.data.clientFirstName || null,
      last_name: parsed.data.clientLastName || null,
      address_city: parsed.data.clientCity || null,
    });
  }

  await insertActivity({
    tenantId: profile.tenant_id,
    leadId: lead.id,
    activityType: "field_updated",
    summary: "Manual lead created",
  });

  revalidatePath("/dashboard/leads");
  return { ok: true, message: "Lead created.", leadId: lead.id };
}

export async function assignLeadToMe(leadId: string): Promise<LeadActionResult> {
  const parsed = leadIdSchema.safeParse(leadId);
  if (!parsed.success) {
    return { ok: false, message: "Invalid lead." };
  }

  const supabase = await createClient();
  const { lead, profile } = await requireLead(parsed.data);
  const { error } = await supabase
    .from("leads")
    .update({ assigned_to: profile.id })
    .eq("id", lead.id)
    .eq("tenant_id", lead.tenant_id);

  if (error) {
    return { ok: false, message: "Unable to assign lead." };
  }

  await insertActivity({
    tenantId: lead.tenant_id,
    leadId: lead.id,
    activityType: "assignment",
    summary: "Assigned to me",
  });

  revalidatePath("/dashboard/leads");
  return { ok: true, message: "Assigned to you." };
}

export async function markLeadContacted(leadId: string): Promise<LeadActionResult> {
  const parsed = leadIdSchema.safeParse(leadId);
  if (!parsed.success) {
    return { ok: false, message: "Invalid lead." };
  }

  const supabase = await createClient();
  const { lead } = await requireLead(parsed.data);
  const { error } = await supabase
    .from("leads")
    .update({ lead_status: "contacted", last_contact_at: new Date().toISOString() })
    .eq("id", lead.id)
    .eq("tenant_id", lead.tenant_id);

  if (error) {
    return { ok: false, message: "Unable to mark contacted." };
  }

  revalidatePath("/dashboard/leads");
  return { ok: true, message: "Marked contacted." };
}

export async function flagLead(leadId: string): Promise<LeadActionResult> {
  const parsed = leadIdSchema.safeParse(leadId);
  if (!parsed.success) {
    return { ok: false, message: "Invalid lead." };
  }

  const { lead } = await requireLead(parsed.data);
  await insertActivity({
    tenantId: lead.tenant_id,
    leadId: lead.id,
    activityType: "flagged",
    summary: "Manual review flag",
  });

  revalidatePath("/dashboard/leads");
  return { ok: true, message: "Flag added." };
}

export async function archiveLead(leadId: string): Promise<LeadActionResult> {
  const parsed = leadIdSchema.safeParse(leadId);
  if (!parsed.success) {
    return { ok: false, message: "Invalid lead." };
  }

  const supabase = await createClient();
  const { lead } = await requireLead(parsed.data);
  const { error } = await supabase
    .from("leads")
    .update({ lead_status: "lost" })
    .eq("id", lead.id)
    .eq("tenant_id", lead.tenant_id);

  if (error) {
    return { ok: false, message: "Unable to archive lead." };
  }

  await insertActivity({
    tenantId: lead.tenant_id,
    leadId: lead.id,
    activityType: "status_change",
    summary: "Lead archived",
  });

  revalidatePath("/dashboard/leads");
  return { ok: true, message: "Lead archived." };
}

export async function scheduleFollowUp(input: {
  leadId: string;
  nextFollowupAt: string;
}): Promise<LeadActionResult> {
  const parsed = z
    .object({
      leadId: leadIdSchema,
      nextFollowupAt: z.string().min(1),
    })
    .safeParse(input);

  if (!parsed.success) {
    return { ok: false, message: "Choose a follow-up date." };
  }

  const supabase = await createClient();
  const { lead } = await requireLead(parsed.data.leadId);
  const { error } = await supabase
    .from("leads")
    .update({ next_followup_at: `${parsed.data.nextFollowupAt}T12:00:00.000Z` })
    .eq("id", lead.id)
    .eq("tenant_id", lead.tenant_id);

  if (error) {
    return { ok: false, message: "Unable to schedule follow-up." };
  }

  await insertActivity({
    tenantId: lead.tenant_id,
    leadId: lead.id,
    activityType: "field_updated",
    summary: "Follow-up scheduled",
  });

  revalidatePath("/dashboard/leads");
  revalidatePath(`/dashboard/leads/${lead.id}`);
  return { ok: true, message: "Follow-up scheduled." };
}
