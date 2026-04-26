import { z } from "zod";
import { anthropic } from "@/lib/anthropic";
import { reconcileLead } from "@/lib/leads/reconcile-lead";
import { supabaseAdmin } from "@/lib/supabase/admin";

export const runtime = "nodejs";

const requestSchema = z.object({
  call_id: z.uuid(),
});

const callSchema = z.object({
  id: z.uuid(),
  tenant_id: z.uuid(),
  caller_phone: z.string().nullable(),
  caller_phone_normalized: z.string().nullable(),
  transcript: z.string().nullable(),
  call_direction: z.string().nullable(),
  call_task_id: z.string().nullable(),
  lead_id: z.string().nullable(),
  extraction: z.unknown().nullable(),
});

const nullableString = z.preprocess(
  (value) => (typeof value === "string" ? value : null),
  z.string().nullable()
);
const objectField = z.preprocess(
  (value) => (value && typeof value === "object" && !Array.isArray(value) ? value : {}),
  z.record(z.string(), z.unknown())
);
const stringArrayField = z.preprocess(
  (value) => (Array.isArray(value) ? value : []),
  z.array(z.string())
);

const extractionSchema = z
  .object({
    summary: z.string().default("Call analyzed."),
    lead_type: z
      .preprocess(
        (value) => (value === "other_or_wrong_number" ? "other" : value),
        z.enum(["client_referral", "caregiver_applicant", "existing_client", "other"])
      )
      .default("client_referral"),
    urgency: z.enum(["emergent", "urgent", "routine", "informational"]).default("routine"),
    name: nullableString.optional(),
    client_name: nullableString.optional(),
    primary_payer: nullableString.optional(),
    payer: nullableString.optional(),
    intake_fields: objectField.default({}),
    contact: objectField.default({}),
    prospective_client: objectField.default({}),
    caregiver_applicant: objectField.default({}),
    red_flags: stringArrayField.default([]),
  })
  .passthrough();
type Extraction = z.infer<typeof extractionSchema>;

const inboundIntakeFieldNames = [
  "lead_type",
  "caller_full_name",
  "caller_callback_number",
  "caller_relationship_to_client",
  "client_first_name",
  "client_last_name",
  "client_date_of_birth",
  "client_address_city",
  "client_address_zip",
  "client_county",
  "client_lives_with",
  "primary_payer",
  "medicaid_active",
  "primary_diagnosis",
  "secondary_diagnoses",
  "has_dementia_diagnosis",
  "fall_risk",
  "falls_last_90_days",
  "uses_oxygen",
  "mobility_status",
  "cognitive_status",
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
  "requested_services",
  "requested_hours_per_week",
  "requested_start_date",
  "preferred_schedule",
  "preferred_caregiver_gender",
  "preferred_caregiver_language",
  "family_caregiver_available",
  "family_caregiver_relationship",
  "family_caregiver_wants_to_be_paid",
  "currently_receiving_services",
  "current_agency_name",
  "reason_for_change",
  "primary_language",
  "requires_interpreter",
  "veteran_status",
  "has_pcp",
  "pcp_name",
  "recent_hospitalization",
  "recent_hospitalization_detail",
  "caregiver_applicant_first_name",
  "caregiver_applicant_last_name",
  "caregiver_applicant_city",
  "caregiver_years_experience",
  "caregiver_experience_types",
  "caregiver_cna_certified",
  "caregiver_hha_certified",
  "caregiver_cpr_certified",
  "caregiver_first_aid_certified",
  "caregiver_languages_spoken",
  "caregiver_has_drivers_license",
  "caregiver_has_reliable_transportation",
  "caregiver_willing_travel_miles",
  "caregiver_hours_per_week_sought",
  "caregiver_availability",
  "caregiver_relationship_to_specific_client",
  "caregiver_willing_to_enroll_champs",
  "caregiver_willing_background_check",
  "urgency",
  "preferred_callback_time",
  "summary",
  "next_action_recommendation",
  "caller_emotional_state",
  "red_flag_emergency",
  "red_flag_notes",
  "extraction_confidence",
] as const;

const outboundCallbackFieldNames = [
  "outbound_purpose",
  "right_person_reached",
  "voicemail_left",
  "callback_requested",
  "callback_time_requested",
  "do_not_call_requested",
  "interest_level",
  "outcome",
  "caregiver_currently_working",
  "caregiver_current_employer",
  "caregiver_still_interested",
  "caregiver_availability_update",
  "caregiver_certifications_update",
  "caregiver_interview_scheduled",
  "caregiver_interview_time",
  "client_eligibility_status",
  "client_assessment_scheduled",
  "client_assessment_time",
  "client_status_update",
  "referral_partner_followup_needed",
  "referral_partner_followup_detail",
  "summary",
  "next_action_recommendation",
  "red_flag_emergency",
  "red_flag_notes",
  "extraction_confidence",
] as const;

const postCallAnalysisFieldNames = [
  ...new Set([...inboundIntakeFieldNames, ...outboundCallbackFieldNames]),
];

function cleanRecord(record: Record<string, unknown>) {
  return Object.fromEntries(
    Object.entries(record).filter(([, value]) => value !== null && value !== undefined && value !== "")
  );
}

function splitCsv(value: unknown) {
  if (Array.isArray(value)) {
    return value.filter((item): item is string => typeof item === "string" && item.trim().length > 0);
  }

  return typeof value === "string"
    ? value
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean)
    : undefined;
}

function safeUrgency(value: unknown, fallback: Extraction["urgency"]) {
  return ["emergent", "urgent", "routine", "informational"].includes(String(value))
    ? (value as Extraction["urgency"])
    : fallback;
}

function normalizeExtraction(extraction: Extraction): Extraction {
  const flatFields = Object.fromEntries(
    postCallAnalysisFieldNames.flatMap((fieldName) => {
      const value = extraction[fieldName as keyof Extraction] ?? extraction.intake_fields[fieldName];
      return value === undefined ? [] : [[fieldName, value]];
    })
  );
  const intakeFields = cleanRecord({
    ...flatFields,
    ...extraction.intake_fields,
  });
  const contact = cleanRecord({
    full_name: intakeFields.caller_full_name ?? extraction.name,
    phone: intakeFields.caller_callback_number,
    relationship_to_client: intakeFields.caller_relationship_to_client,
    best_time_to_reach: intakeFields.preferred_callback_time,
    ...extraction.contact,
  });
  const prospectiveClient = cleanRecord({
    first_name: intakeFields.client_first_name,
    last_name: intakeFields.client_last_name,
    date_of_birth: intakeFields.client_date_of_birth,
    address_city: intakeFields.client_address_city,
    address_zip: intakeFields.client_address_zip,
    county: intakeFields.client_county,
    lives_with: intakeFields.client_lives_with,
    primary_payer: intakeFields.primary_payer,
    medicaid_active: intakeFields.medicaid_active,
    primary_diagnosis: intakeFields.primary_diagnosis,
    secondary_diagnoses: intakeFields.secondary_diagnoses,
    has_dementia_diagnosis: intakeFields.has_dementia_diagnosis,
    fall_risk: intakeFields.fall_risk,
    falls_last_90_days: intakeFields.falls_last_90_days,
    uses_oxygen: intakeFields.uses_oxygen,
    mobility_status: intakeFields.mobility_status,
    cognitive_status: intakeFields.cognitive_status,
    adl_bathing: intakeFields.adl_bathing,
    adl_dressing: intakeFields.adl_dressing,
    adl_grooming: intakeFields.adl_grooming,
    adl_toileting: intakeFields.adl_toileting,
    adl_transferring: intakeFields.adl_transferring,
    adl_eating: intakeFields.adl_eating,
    continence_bladder: intakeFields.continence_bladder,
    continence_bowel: intakeFields.continence_bowel,
    iadl_meal_prep: intakeFields.iadl_meal_prep,
    iadl_light_housework: intakeFields.iadl_light_housework,
    iadl_laundry: intakeFields.iadl_laundry,
    iadl_shopping: intakeFields.iadl_shopping,
    iadl_medication_reminders: intakeFields.iadl_medication_reminders,
    iadl_transportation: intakeFields.iadl_transportation,
    requested_services: splitCsv(intakeFields.requested_services),
    requested_hours_per_week: intakeFields.requested_hours_per_week,
    requested_start_date: intakeFields.requested_start_date,
    preferred_schedule: intakeFields.preferred_schedule,
    preferred_caregiver_gender: intakeFields.preferred_caregiver_gender,
    preferred_caregiver_language: intakeFields.preferred_caregiver_language,
    family_caregiver_available: intakeFields.family_caregiver_available,
    family_caregiver_relationship: intakeFields.family_caregiver_relationship,
    family_caregiver_wants_to_be_paid: intakeFields.family_caregiver_wants_to_be_paid,
    currently_receiving_services: intakeFields.currently_receiving_services,
    current_agency_name: intakeFields.current_agency_name,
    reason_for_change: intakeFields.reason_for_change,
    primary_language: intakeFields.primary_language,
    requires_interpreter: intakeFields.requires_interpreter,
    veteran_status: intakeFields.veteran_status,
    has_pcp: intakeFields.has_pcp,
    pcp_name: intakeFields.pcp_name,
    recent_hospitalization: intakeFields.recent_hospitalization,
    recent_hospitalization_detail: intakeFields.recent_hospitalization_detail,
    ...extraction.prospective_client,
  });
  const caregiverApplicant = cleanRecord({
    first_name: intakeFields.caregiver_applicant_first_name,
    last_name: intakeFields.caregiver_applicant_last_name,
    phone: intakeFields.caller_callback_number,
    address_city: intakeFields.caregiver_applicant_city,
    years_experience: intakeFields.caregiver_years_experience,
    experience_types: splitCsv(intakeFields.caregiver_experience_types),
    cna_certified: intakeFields.caregiver_cna_certified,
    hha_certified: intakeFields.caregiver_hha_certified,
    cpr_certified: intakeFields.caregiver_cpr_certified,
    first_aid_certified: intakeFields.caregiver_first_aid_certified,
    languages_spoken: splitCsv(intakeFields.caregiver_languages_spoken),
    has_drivers_license: intakeFields.caregiver_has_drivers_license,
    has_reliable_transportation: intakeFields.caregiver_has_reliable_transportation,
    willing_to_travel_miles: intakeFields.caregiver_willing_travel_miles,
    hours_per_week_sought: intakeFields.caregiver_hours_per_week_sought,
    availability: intakeFields.caregiver_availability,
    relationship_to_prospective_client: intakeFields.caregiver_relationship_to_specific_client,
    willing_to_enroll_in_champs: intakeFields.caregiver_willing_to_enroll_champs,
    willing_background_check: intakeFields.caregiver_willing_background_check,
    notes: extraction.summary,
    ...extraction.caregiver_applicant,
  });
  const outboundFields = cleanRecord({
    outbound_purpose: intakeFields.outbound_purpose,
    right_person_reached: intakeFields.right_person_reached,
    voicemail_left: intakeFields.voicemail_left,
    callback_requested: intakeFields.callback_requested,
    callback_time_requested: intakeFields.callback_time_requested,
    do_not_call_requested: intakeFields.do_not_call_requested,
    interest_level: intakeFields.interest_level,
    outcome: intakeFields.outcome,
    caregiver_currently_working: intakeFields.caregiver_currently_working,
    caregiver_current_employer: intakeFields.caregiver_current_employer,
    caregiver_still_interested: intakeFields.caregiver_still_interested,
    caregiver_availability_update: intakeFields.caregiver_availability_update,
    caregiver_certifications_update: intakeFields.caregiver_certifications_update,
    caregiver_interview_scheduled: intakeFields.caregiver_interview_scheduled,
    caregiver_interview_time: intakeFields.caregiver_interview_time,
    client_eligibility_status: intakeFields.client_eligibility_status,
    client_assessment_scheduled: intakeFields.client_assessment_scheduled,
    client_assessment_time: intakeFields.client_assessment_time,
    client_status_update: intakeFields.client_status_update,
    referral_partner_followup_needed: intakeFields.referral_partner_followup_needed,
    referral_partner_followup_detail: intakeFields.referral_partner_followup_detail,
  });

  return {
    ...extraction,
    urgency: safeUrgency(intakeFields.urgency, extraction.urgency),
    name: extraction.name ?? (typeof intakeFields.caller_full_name === "string" ? intakeFields.caller_full_name : null),
    client_name:
      extraction.client_name ??
      ([intakeFields.client_first_name, intakeFields.client_last_name]
        .filter(Boolean)
        .join(" ") ||
        null),
    primary_payer:
      extraction.primary_payer ??
      (typeof intakeFields.primary_payer === "string" ? intakeFields.primary_payer : null),
    payer:
      extraction.payer ??
      (typeof intakeFields.primary_payer === "string" ? intakeFields.primary_payer : null),
    intake_fields: intakeFields,
    contact,
    prospective_client: prospectiveClient,
    caregiver_applicant: {
      ...caregiverApplicant,
      ...cleanRecord({
        current_employer: outboundFields.caregiver_current_employer,
        availability: outboundFields.caregiver_availability_update ?? caregiverApplicant.availability,
        notes: [
          caregiverApplicant.notes,
          outboundFields.caregiver_certifications_update
            ? `Certification update: ${outboundFields.caregiver_certifications_update}`
            : null,
          outboundFields.caregiver_interview_time
            ? `Interview time: ${outboundFields.caregiver_interview_time}`
            : null,
        ]
          .filter(Boolean)
          .join("\n"),
      }),
    },
    red_flags: [
      ...extraction.red_flags,
      ...(intakeFields.red_flag_notes && typeof intakeFields.red_flag_notes === "string"
        ? [intakeFields.red_flag_notes]
        : []),
    ],
  };
}

function unauthorized() {
  return Response.json({ error: "unauthorized" }, { status: 401 });
}

function extractText(content: unknown) {
  if (!Array.isArray(content)) {
    return "";
  }

  return content
    .map((block) =>
      block &&
      typeof block === "object" &&
      "type" in block &&
      block.type === "text" &&
      "text" in block &&
      typeof block.text === "string"
        ? block.text
        : ""
    )
    .join("\n")
    .trim();
}

function parseJsonObject(text: string) {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const raw = fenced?.[1] ?? text;
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");

  if (start === -1 || end === -1 || end <= start) {
    throw new Error("No JSON object returned");
  }

  return JSON.parse(raw.slice(start, end + 1)) as unknown;
}

async function buildExtraction(transcript: string, callerPhone: string | null) {
  const message = await anthropic.messages.create({
    model: process.env.ANTHROPIC_MODEL ?? "claude-sonnet-4-6",
    max_tokens: 5000,
    temperature: 0,
    system:
      "Extract structured Michigan homecare intake facts from a call transcript. Return only one JSON object. Do not include markdown. Use null or empty objects when unknown. Never invent facts not present in the transcript.",
    messages: [
      {
        role: "user",
        content: `Transcript:\n${transcript}\n\nCaller phone: ${
          callerPhone ?? "unknown"
        }\n\nReturn JSON with these keys:
- summary
- lead_type: one of client_referral, caregiver_applicant, existing_client, other
- urgency: one of emergent, urgent, routine, informational
- name, client_name, primary_payer, payer
- intake_fields: object containing these inbound and outbound script fields when known: ${postCallAnalysisFieldNames.join(", ")}
- contact: database object with full_name, phone, relationship_to_client, best_time_to_reach, notes
- prospective_client: database object for care recipients using columns like first_name, last_name, date_of_birth, address_city, address_zip, county, lives_with, primary_payer, medicaid_active, primary_diagnosis, secondary_diagnoses, ADL/IADL fields, requested_services as an array, requested_hours_per_week, preferred_schedule, language, PCP, hospitalization, family caregiver, current agency fields
- caregiver_applicant: database object for job applicants using columns like first_name, last_name, phone, address_city, years_experience, experience_types as an array, certifications, languages_spoken as an array, transportation, travel miles, hours sought, availability, CHAMPS/background check fields
- red_flags: array of red flag strings

For outbound callback calls, populate outbound_purpose, right_person_reached, voicemail_left, callback_requested, callback_time_requested, do_not_call_requested, interest_level, outcome, and the caregiver/client/referral follow-up update fields whenever the transcript supports them.

Use null for unknown scalar fields. contact.relationship_to_client must use a database-safe value when known, such as self, spouse, adult_child, case_manager, caregiver_applicant, other, or unknown. For summary, use first name + last initial only and do not include street addresses, Medicaid IDs, or DOBs.`,
      },
    ],
  });

  return normalizeExtraction(extractionSchema.parse(parseJsonObject(extractText(message.content))));
}

function safeRelationship(value: unknown) {
  const allowed = new Set([
    "self",
    "spouse",
    "adult_child",
    "parent",
    "sibling",
    "other_family",
    "friend",
    "case_manager",
    "hospital_social_worker",
    "referral_source",
    "poa_financial",
    "poa_medical",
    "guardian",
    "caregiver_applicant",
    "other",
    "unknown",
  ]);
  return typeof value === "string" && allowed.has(value) ? value : "unknown";
}

async function createFallbackLead(params: {
  call: z.infer<typeof callSchema>;
  extraction: Extraction;
}) {
  const { call, extraction } = params;
  const contact = extraction.contact;
  const { data: lead, error: leadError } = await supabaseAdmin
    .from("leads")
    .insert({
      tenant_id: call.tenant_id,
      lead_type: extraction.lead_type,
      lead_status: "new",
      source: call.call_direction === "outbound" ? "other" : "phone_inbound",
      urgency: extraction.urgency,
      first_contact_at: new Date().toISOString(),
      last_contact_at: new Date().toISOString(),
      notes: extraction.summary,
    })
    .select("id")
    .single<{ id: string }>();

  if (leadError || !lead) {
    throw new Error("Unable to create fallback lead");
  }

  await supabaseAdmin.from("contacts").insert({
    tenant_id: call.tenant_id,
    lead_id: lead.id,
    full_name:
      (typeof contact.full_name === "string" && contact.full_name) ||
      extraction.client_name ||
      extraction.name ||
      null,
    phone:
      (typeof contact.phone === "string" && contact.phone) ||
      call.caller_phone_normalized ||
      call.caller_phone,
    relationship_to_client: safeRelationship(contact.relationship_to_client),
    is_primary_contact: true,
    preferred_contact_method: "phone",
  });

  await supabaseAdmin
    .from("intake_calls")
    .update({ lead_id: lead.id, status: "merged_into_lead", updated_at: new Date().toISOString() })
    .eq("id", call.id)
    .eq("tenant_id", call.tenant_id);

  if (call.call_task_id) {
    await supabaseAdmin
      .from("call_tasks")
      .update({
        lead_id: lead.id,
        status: "completed",
        disposition: "answered_completed",
        updated_at: new Date().toISOString(),
      })
      .eq("id", call.call_task_id)
      .eq("tenant_id", call.tenant_id);
  }

  return lead.id;
}

export async function POST(request: Request) {
  const secret = process.env.INTERNAL_API_SECRET;
  if (!secret || request.headers.get("x-internal-secret") !== secret) {
    return unauthorized();
  }

  const parsed = requestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return Response.json({ error: "invalid" }, { status: 400 });
  }

  const { data: callData, error: callError } = await supabaseAdmin
    .from("intake_calls")
    .select("id, tenant_id, caller_phone, caller_phone_normalized, transcript, call_direction, call_task_id, lead_id, extraction")
    .eq("id", parsed.data.call_id)
    .single();

  if (callError || !callData) {
    return Response.json({ error: "not_found" }, { status: 404 });
  }

  const call = callSchema.parse(callData);
  if (call.lead_id && call.extraction) {
    return Response.json({ ok: true, lead_id: call.lead_id, skipped: "already_extracted" });
  }

  if (!call.transcript?.trim()) {
    return Response.json({ error: "transcript_required" }, { status: 422 });
  }

  try {
    const extraction = await buildExtraction(
      call.transcript,
      call.caller_phone_normalized ?? call.caller_phone
    );

    const { error: updateError } = await supabaseAdmin
      .from("intake_calls")
      .update({
        extraction,
        extraction_confidence: "medium",
        status: "extracted",
        updated_at: new Date().toISOString(),
      })
      .eq("id", call.id)
      .eq("tenant_id", call.tenant_id);

    if (updateError) {
      throw new Error("Unable to store extraction");
    }

    let leadId: string;
    let action = "merged";
    try {
      const reconciliation = await reconcileLead(call.id, call.tenant_id);
      leadId = reconciliation.lead_id;
      action = reconciliation.action;
    } catch {
      leadId = await createFallbackLead({ call, extraction });
      action = "created";
    }

    await supabaseAdmin.from("call_events").insert({
      tenant_id: call.tenant_id,
      call_id: call.id,
      lead_id: leadId,
      event_type: "extraction_completed",
      payload: { action },
    });

    return Response.json({ ok: true, lead_id: leadId });
  } catch (error) {
    await supabaseAdmin.from("call_events").insert({
      tenant_id: call.tenant_id,
      call_id: call.id,
      event_type: "extraction_failed",
      payload: { reason: error instanceof Error ? error.message : "unknown" },
    });

    return Response.json({ error: "extraction_failed" }, { status: 500 });
  }
}
