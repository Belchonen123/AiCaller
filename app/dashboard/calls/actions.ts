"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import { normalizePhone } from "@/lib/phone";
import { createClient } from "@/lib/supabase/server";

export type CallActionResult = {
  ok: boolean;
  message: string;
};

const relinkSchema = z.object({
  callId: z.uuid(),
  targetLeadId: z.uuid(),
});

const callIdSchema = z.uuid();
const leadTypes = new Set(["client_referral", "caregiver_applicant", "existing_client", "other"]);
const urgencies = new Set(["emergent", "urgent", "routine", "informational"]);
const payerValues = new Set([
  "medicaid_home_help",
  "mi_choice_waiver",
  "mco_meridian",
  "mco_molina",
  "mco_hap",
  "mco_aetna_better_health",
  "mco_priority_health",
  "mco_united_community",
  "mco_bcbs_complete",
  "mco_other",
  "medicare",
  "medicare_advantage",
  "private_pay",
  "ltc_insurance",
  "va",
  "dual_eligible",
  "self_pay_pending_medicaid",
  "unknown",
  "not_discussed",
]);

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function text(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function leadType(value: unknown) {
  const normalized = value === "other_or_wrong_number" ? "other" : text(value);
  return normalized && leadTypes.has(normalized) ? normalized : "client_referral";
}

function urgency(value: unknown) {
  const normalized = text(value);
  return normalized && urgencies.has(normalized) ? normalized : "routine";
}

function safePayer(value: unknown) {
  const normalized = text(value);
  return normalized && payerValues.has(normalized) ? normalized : null;
}

function clean<T extends Record<string, unknown>>(value: T) {
  return Object.fromEntries(
    Object.entries(value).filter(([, item]) => item !== null && item !== undefined && item !== "")
  );
}

export async function relinkCallFromDetail(input: unknown): Promise<CallActionResult> {
  const parsed = relinkSchema.safeParse(input);

  if (!parsed.success) {
    return { ok: false, message: "Invalid relink request." };
  }

  const supabase = await createClient();
  const { profile } = await getCurrentUser();
  const { data: lead, error: leadError } = await supabase
    .from("leads")
    .select("id, tenant_id")
    .eq("id", parsed.data.targetLeadId)
    .eq("tenant_id", profile.tenant_id)
    .single();

  if (leadError || !lead) {
    return { ok: false, message: "Target lead not found." };
  }

  const { error } = await supabase
    .from("intake_calls")
    .update({ lead_id: parsed.data.targetLeadId, status: "merged_into_lead" })
    .eq("id", parsed.data.callId)
    .eq("tenant_id", profile.tenant_id);

  if (error) {
    return { ok: false, message: "Unable to relink call." };
  }

  await supabase.from("call_events").insert({
    tenant_id: profile.tenant_id,
    call_id: parsed.data.callId,
    lead_id: lead.id,
    event_type: "call_relinked",
    payload: { lead_id: lead.id },
    created_by: profile.id,
  });

  revalidatePath(`/dashboard/calls/${parsed.data.callId}`);
  return { ok: true, message: "Call relinked." };
}

export async function createLeadFromCall(callId: string): Promise<CallActionResult & { leadId?: string }> {
  const parsed = callIdSchema.safeParse(callId);

  if (!parsed.success) {
    return { ok: false, message: "Invalid call." };
  }

  const supabase = await createClient();
  const { profile } = await getCurrentUser();
  const { data: call, error: callError } = await supabase
    .from("intake_calls")
    .select("id, tenant_id, caller_phone, caller_phone_normalized, extraction")
    .eq("id", parsed.data)
    .eq("tenant_id", profile.tenant_id)
    .single();

  if (callError || !call) {
    return { ok: false, message: "Call not found." };
  }

  const extraction = record(call.extraction);
  if (!Object.keys(extraction).length) {
    return { ok: false, message: "Run extraction before creating a lead." };
  }

  const contact = record(extraction.contact);
  const client = record(extraction.prospective_client);
  const caregiver = record(extraction.caregiver_applicant);
  const type = leadType(extraction.lead_type);
  const fallbackPhone = call.caller_phone_normalized ?? call.caller_phone ?? null;
  const contactPhone = text(contact.phone) ?? fallbackPhone;
  const { data: lead, error: leadError } = await supabase
    .from("leads")
    .insert({
      tenant_id: profile.tenant_id,
      lead_type: type,
      lead_status: "new",
      source: "phone_inbound",
      urgency: urgency(extraction.urgency),
      first_contact_at: new Date().toISOString(),
      last_contact_at: new Date().toISOString(),
      notes: text(extraction.summary),
    })
    .select("id")
    .single();

  if (leadError || !lead) {
    return { ok: false, message: "Unable to create lead from call." };
  }

  await supabase.from("contacts").insert({
    tenant_id: profile.tenant_id,
    lead_id: lead.id,
    full_name:
      text(contact.full_name) ??
      text(extraction.client_name) ??
      text(extraction.name),
    phone: contactPhone ? normalizePhone(contactPhone) ?? contactPhone : null,
    email: text(contact.email),
    relationship_to_client: text(contact.relationship_to_client),
    is_primary_contact: true,
    preferred_contact_method: "phone",
    best_time_to_reach: text(contact.best_time_to_reach),
  });

  if (type === "client_referral" || type === "existing_client") {
    await supabase.from("prospective_clients").insert(
      clean({
        tenant_id: profile.tenant_id,
        lead_id: lead.id,
        first_name: text(client.first_name),
        last_name: text(client.last_name),
        address_city: text(client.address_city),
        address_zip: text(client.address_zip),
        county: text(client.county),
        primary_payer: safePayer(client.primary_payer ?? extraction.primary_payer ?? extraction.payer),
        primary_diagnosis: text(client.primary_diagnosis),
      })
    );
  }

  if (type === "caregiver_applicant") {
    await supabase.from("caregiver_applicants").insert(
      clean({
        tenant_id: profile.tenant_id,
        lead_id: lead.id,
        first_name: text(caregiver.first_name),
        last_name: text(caregiver.last_name),
        phone: contactPhone ? normalizePhone(contactPhone) ?? contactPhone : null,
        email: text(caregiver.email ?? contact.email),
        address_city: text(caregiver.address_city),
        status: "new",
        notes: text(extraction.summary),
      })
    );
  }

  await supabase
    .from("intake_calls")
    .update({ lead_id: lead.id, status: "merged_into_lead" })
    .eq("id", call.id)
    .eq("tenant_id", profile.tenant_id);

  await supabase.from("call_events").insert({
    tenant_id: profile.tenant_id,
    call_id: call.id,
    lead_id: lead.id,
    event_type: "merged",
    payload: { source: "manual_create_from_call" },
    created_by: profile.id,
  });

  revalidatePath(`/dashboard/calls/${call.id}`);
  revalidatePath("/dashboard/leads");
  return { ok: true, message: "New lead created from call.", leadId: lead.id };
}

export async function rerunExtraction(callId: string): Promise<CallActionResult> {
  const parsed = z.uuid().safeParse(callId);

  if (!parsed.success) {
    return { ok: false, message: "Invalid call." };
  }

  const { profile } = await getCurrentUser();

  if (!["admin", "owner"].includes(profile.role)) {
    return { ok: false, message: "Only admins and owners can re-run extraction." };
  }

  const secret = process.env.INTERNAL_API_SECRET;

  if (!secret) {
    return { ok: false, message: "Extraction endpoint is not configured." };
  }

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  const response = await fetch(`${baseUrl}/api/retell/extract`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-internal-secret": secret,
    },
    body: JSON.stringify({ call_id: parsed.data }),
  });

  if (!response.ok) {
    return { ok: false, message: "Unable to re-run extraction." };
  }

  revalidatePath(`/dashboard/calls/${parsed.data}`);
  return { ok: true, message: "Extraction refreshed." };
}
