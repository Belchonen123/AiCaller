import { createClient } from "@supabase/supabase-js";
import { faker } from "@faker-js/faker";

type LeadType = "client_referral" | "caregiver_applicant" | "existing_client" | "other";
type ExtractionConfidence = "high" | "medium" | "low";

type LeadSeed = {
  leadType: LeadType;
  status: string;
  urgency: string | null;
  city: string;
  zip: string;
  county: string;
  payer?: string;
  diagnosis?: string;
  caregiverStatus?: string;
  yearsExperience?: number;
  note: string;
};

type InsertCounts = {
  leads: number;
  calls: number;
  activities: number;
};

if (process.env.NODE_ENV === "production") {
  throw new Error("Refusing to seed demo data when NODE_ENV is production.");
}

const supabaseUrl = getRequiredEnv("NEXT_PUBLIC_SUPABASE_URL");
const serviceRoleKey = getRequiredEnv("SUPABASE_SERVICE_ROLE_KEY");
const tenantId = getRequiredEnv("DEMO_TENANT_ID");

faker.seed(42);

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

const areaCodes = ["248", "313", "586", "734", "810"];
const agencyStyleNames = [
  "Bridgewater Home Care",
  "Detroit Metro Caregivers",
  "Great Lakes Personal Care",
  "Motor City Home Help",
  "Oakland County Care Partners",
] as const;
const cities = [
  ["Detroit", "48201", "Wayne"],
  ["Detroit", "48227", "Wayne"],
  ["Detroit", "48235", "Wayne"],
  ["Southfield", "48075", "Oakland"],
  ["Southfield", "48076", "Oakland"],
  ["Detroit", "48219", "Wayne"],
  ["Detroit", "48221", "Wayne"],
  ["Oak Park", "48237", "Oakland"],
  ["Highland Park", "48203", "Wayne"],
  ["West Bloomfield", "48323", "Oakland"],
] as const;

const diagnoses = [
  "CHF",
  "COPD",
  "diabetes with neuropathy",
  "Alzheimer's disease",
  "Parkinson's disease",
  "post-CVA weakness",
  "dementia NOS",
] as const;

const leadSeeds: LeadSeed[] = [
  {
    leadType: "client_referral",
    status: "info_gathering",
    urgency: "urgent",
    city: "Detroit",
    zip: "48235",
    county: "Wayne",
    payer: "mco_meridian",
    diagnosis: "post-CVA weakness",
    note: "WOW lead: multi-call Meridian referral with full extraction and family dynamics.",
  },
  {
    leadType: "client_referral",
    status: "new",
    urgency: "emergent",
    city: "Southfield",
    zip: "48075",
    county: "Oakland",
    payer: "medicaid_home_help",
    diagnosis: "Alzheimer's disease",
    note: "WOW lead: red-flag fall and emergency callback scenario.",
  },
  {
    leadType: "client_referral",
    status: "authorized",
    urgency: "routine",
    city: "Oak Park",
    zip: "48237",
    county: "Oakland",
    payer: "mi_choice_waiver",
    diagnosis: "Parkinson's disease",
    note: "WOW lead: high-confidence authorized case ready for scheduling.",
  },
  ...[
    "new",
    "contacted",
    "info_gathering",
    "pending_eligibility",
    "authorized",
    "enrolled",
    "disqualified",
    "lost",
    "new",
    "pending_eligibility",
  ].map((status, index): LeadSeed => {
    const [city, zip, county] = cities[index];
    const payer =
      index < 6
        ? "medicaid_home_help"
        : index < 8
          ? "mi_choice_waiver"
          : index === 8
            ? "mco_meridian"
            : "private_pay";
    return {
      leadType: "client_referral",
      status,
      urgency: index % 3 === 0 ? "urgent" : "routine",
      city,
      zip,
      county,
      payer,
      diagnosis: diagnoses[index % diagnoses.length],
      note: "Synthetic client referral for Michigan Home Help demo.",
    };
  }),
  ...["new", "phone_screened", "interview_scheduled", "cleared", "hired"].map(
    (status, index): LeadSeed => {
      const [city, zip, county] = cities[(index + 2) % cities.length];
      return {
        leadType: "caregiver_applicant",
        status: "new",
        caregiverStatus: status,
        urgency: "informational",
        city,
        zip,
        county,
        yearsExperience: [1, 3, 5, 9, 15][index],
        note: "Synthetic caregiver applicant routed from intake.",
      };
    }
  ),
  ...[0, 1, 2].map((index): LeadSeed => {
    const [city, zip, county] = cities[(index + 6) % cities.length];
    return {
      leadType: "existing_client",
      status: "contacted",
      urgency: "informational",
      city,
      zip,
      county,
      payer: "medicaid_home_help",
      diagnosis: diagnoses[(index + 3) % diagnoses.length],
      note: "Synthetic existing client question.",
    };
  }),
  {
    leadType: "other",
    status: "lost",
    urgency: null,
    city: "Detroit",
    zip: "48201",
    county: "Wayne",
    note: "Synthetic wrong number.",
  },
  {
    leadType: "other",
    status: "new",
    urgency: "informational",
    city: "Southfield",
    zip: "48075",
    county: "Oakland",
    note: "Synthetic general inquiry.",
  },
];

const confidencePlan: ExtractionConfidence[] = [
  ...Array.from({ length: 12 }, () => "high" as const),
  ...Array.from({ length: 6 }, () => "medium" as const),
  ...Array.from({ length: 2 }, () => "low" as const),
];

function getRequiredEnv(name: string) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} is required.`);
  }
  return value;
}

function syntheticPhone(index: number) {
  const areaCode = areaCodes[index % areaCodes.length];
  const prefix = String(200 + ((index * 37) % 700)).padStart(3, "0");
  const line = String(1000 + ((index * 91) % 9000)).padStart(4, "0");
  return `+1${areaCode}${prefix}${line}`;
}

function daysAgo(days: number) {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return date.toISOString();
}

function aliveDate(index: number, offset = 0) {
  const dayPattern = [0, 0, 1, 1, 2, 3, 5, 7, 9, 12, 14, 18, 21, 28];
  return daysAgo(dayPattern[index % dayPattern.length] + offset);
}

function fullName() {
  return `${faker.person.firstName()} ${faker.person.lastName()}`;
}

function clientExtraction(seed: LeadSeed, clientName: string, contactName: string) {
  return {
    summary: `${contactName} called about home help for ${clientName} in ${seed.city}.`,
    lead_type: seed.leadType,
    urgency: seed.urgency,
    contact: {
      full_name: contactName,
      phone: syntheticPhone(faker.number.int({ min: 1, max: 99 })),
      relationship_to_client: "adult_child",
      preferred_contact_method: "phone",
      best_time_to_reach: "Weekday afternoons",
    },
    prospective_client: {
      first_name: clientName.split(" ")[0],
      last_name: clientName.split(" ").slice(1).join(" "),
      preferred_name: clientName.split(" ")[0],
      date_of_birth: faker.date.birthdate({ min: 68, max: 92, mode: "age" }).toISOString().slice(0, 10),
      age: faker.number.int({ min: 68, max: 92 }),
      gender: faker.helpers.arrayElement(["female", "male", "unknown"]),
      marital_status: faker.helpers.arrayElement(["widowed", "married", "single", "unknown"]),
      primary_language: "English",
      requires_interpreter: false,
      ethnicity: faker.helpers.arrayElement(["Black or African American", "White", "Arab American", "Prefer not to say"]),
      veteran_status: faker.datatype.boolean({ probability: 0.15 }),
      address_city: seed.city,
      address_state: "MI",
      address_zip: seed.zip,
      county: seed.county,
      lives_with: faker.helpers.arrayElement(["alone", "with adult child", "with spouse", "with sister"]),
      home_type: faker.helpers.arrayElement(["house", "apartment", "family_home"]),
      stairs_to_enter: faker.datatype.boolean(),
      pets_in_home: faker.helpers.arrayElement(["none", "small dog", "cat"]),
      smoking_in_home: faker.datatype.boolean({ probability: 0.2 }),
      home_safety_concerns: faker.helpers.arrayElement(["fall risk near bathroom", "cluttered hallway", "none reported"]),
      medicaid_id: `TEST-${faker.string.numeric(8)}`,
      medicare_id: `TEST-MED-${faker.string.alphanumeric(6).toUpperCase()}`,
      ssn_last4: faker.string.numeric(4),
      ss_benefits_receiving: true,
      has_pcp: true,
      pcp_name: `Dr. ${faker.person.lastName()}`,
      pcp_phone: syntheticPhone(faker.number.int({ min: 100, max: 199 })),
      pcp_practice: faker.company.name(),
      recent_hospitalization: faker.datatype.boolean({ probability: 0.35 }),
      recent_hospitalization_detail: "Recent discharge noted in synthetic intake.",
      primary_payer: seed.payer,
      mco_plan_name: seed.payer === "mco_meridian" ? "Meridian" : null,
      medicaid_active: seed.payer !== "private_pay",
      medicaid_pending: false,
      has_mi_choice_waiver: seed.payer === "mi_choice_waiver",
      has_medicare_advantage: false,
      ltc_policy_carrier: seed.payer === "private_pay" ? "None discussed" : null,
      va_benefits: false,
      estimated_monthly_budget_private_pay: seed.payer === "private_pay" ? 2200 : null,
      adl_bathing: "total_assist",
      adl_dressing: "partial_assist",
      adl_grooming: "supervision",
      adl_toileting: "partial_assist",
      adl_transferring: faker.helpers.arrayElement(["partial_assist", "supervision"]),
      adl_eating: faker.helpers.arrayElement(["supervision", "independent"]),
      continence_bladder: "occasional_incontinence",
      continence_bowel: "continent",
      iadl_meal_prep: "needs_help",
      iadl_light_housework: "total_assist",
      iadl_laundry: "needs_help",
      iadl_shopping: "needs_help",
      iadl_medication_reminders: "needs_help",
      iadl_transportation: "needs_help",
      mobility_status: faker.helpers.arrayElement(["walker", "cane", "wheelchair_manual"]),
      uses_oxygen: seed.diagnosis === "COPD",
      fall_risk: true,
      falls_last_90_days: faker.number.int({ min: 0, max: 3 }),
      medical_equipment: "walker, shower chair",
      cognitive_status: seed.diagnosis?.includes("dementia") || seed.diagnosis?.includes("Alzheimer")
        ? "moderate_impairment"
        : "mild_impairment",
      has_dementia_diagnosis: Boolean(seed.diagnosis?.includes("dementia") || seed.diagnosis?.includes("Alzheimer")),
      behavioral_concerns: seed.diagnosis?.includes("dementia") ? "wandering in evenings" : "none reported",
      mental_health_history: "not discussed",
      primary_diagnosis: seed.diagnosis,
      secondary_diagnoses: "hypertension, arthritis",
      medications_count: faker.number.int({ min: 4, max: 12 }),
      medication_list: "Synthetic medication list to be confirmed by staff.",
      requested_services: ["personal_care", "meal_prep", "light_housework", "transportation"],
      requested_hours_per_week: faker.number.int({ min: 12, max: 32 }),
      requested_start_date: faker.date.soon({ days: 21 }).toISOString().slice(0, 10),
      preferred_schedule: "Weekday mornings preferred",
      preferred_caregiver_gender: "no_preference",
      preferred_caregiver_language: "English",
      caregiver_notes: "Patient prefers a calm caregiver.",
      family_caregiver_available: faker.datatype.boolean({ probability: 0.45 }),
      family_caregiver_relationship: "adult child",
      family_caregiver_wants_to_be_paid: faker.datatype.boolean({ probability: 0.25 }),
      currently_receiving_services: faker.datatype.boolean({ probability: 0.25 }),
      current_agency_name: "Synthetic Prior Agency",
      reason_for_change: "Needs more consistent staffing.",
    },
    red_flags:
      seed.urgency === "emergent"
        ? ["caller mentioned a fall with possible injury", "same-day callback recommended"]
        : seed.urgency === "urgent"
          ? ["recent fall risk", "caregiver burnout"]
          : [],
  };
}

function caregiverExtraction(seed: LeadSeed, applicantName: string) {
  return {
    summary: `${applicantName} called about caregiver work near ${seed.city}.`,
    lead_type: "caregiver_applicant",
    urgency: "informational",
    contact: {
      full_name: applicantName,
      phone: syntheticPhone(faker.number.int({ min: 200, max: 299 })),
      relationship_to_client: "caregiver_applicant",
      preferred_contact_method: "phone",
    },
    caregiver_applicant: {
      first_name: applicantName.split(" ")[0],
      last_name: applicantName.split(" ").slice(1).join(" "),
      phone: syntheticPhone(faker.number.int({ min: 300, max: 399 })),
      email: faker.internet.email({ firstName: applicantName.split(" ")[0] }).toLowerCase(),
      address_city: seed.city,
      address_state: "MI",
      address_zip: seed.zip,
      date_of_birth: faker.date.birthdate({ min: 21, max: 58, mode: "age" }).toISOString().slice(0, 10),
      has_drivers_license: true,
      has_reliable_transportation: faker.datatype.boolean({ probability: 0.85 }),
      willing_to_travel_miles: faker.helpers.arrayElement([10, 15, 20, 25]),
      years_experience: seed.yearsExperience ?? 2,
      experience_types: faker.helpers.arrayElements(["personal_care", "dementia", "hospice", "behavioral", "companion"], { min: 1, max: 3 }),
      cna_certified: faker.datatype.boolean({ probability: 0.4 }),
      hha_certified: faker.datatype.boolean({ probability: 0.35 }),
      cpr_certified: faker.datatype.boolean({ probability: 0.55 }),
      first_aid_certified: faker.datatype.boolean({ probability: 0.45 }),
      languages_spoken: faker.helpers.arrayElements(["English", "Spanish", "Arabic"], { min: 1, max: 2 }),
      hours_per_week_sought: faker.helpers.arrayElement([20, 30, 40]),
      availability: "Weekdays and every other weekend",
      has_been_in_champs: faker.datatype.boolean({ probability: 0.25 }),
      willing_to_enroll_in_champs: true,
      referred_by: faker.helpers.arrayElement(["Indeed", "friend", "Facebook group", "walk-in"]),
      relationship_to_prospective_client: null,
      willing_background_check: true,
      status: seed.caregiverStatus,
      notes: "Synthetic caregiver applicant.",
    },
    red_flags: [],
  };
}

function otherExtraction(seed: LeadSeed, callerName: string) {
  return {
    summary: seed.status === "lost" ? "Wrong number call." : "General inquiry for agency staff.",
    lead_type: seed.leadType,
    urgency: seed.urgency,
    contact: {
      full_name: callerName,
      phone: syntheticPhone(faker.number.int({ min: 400, max: 499 })),
      relationship_to_client: "unknown",
    },
    red_flags: [],
  };
}

function makeTranscript(seed: LeadSeed, callerName: string, subjectName: string) {
  if (seed.leadType === "caregiver_applicant") {
    return [
      `Agent: Thank you for calling ${faker.helpers.arrayElement(agencyStyleNames)}. This is the intake assistant. How can I help today?`,
      `Caller: Hi, my name is ${callerName}. I'm calling about caregiver work around ${seed.city}. I live nearby and I saw your agency mentioned in a Detroit caregiver group.`,
      `Agent: I can take the first screening message for hiring. How many years of caregiving experience do you have, and what kind of clients have you supported?`,
      `Caller: About ${seed.yearsExperience ?? 2} years. Mostly seniors who need help with bathing, meals, transfers, and dementia reminders. I helped one lady near Seven Mile after her stroke and I also covered weekends for a family in Southfield.`,
      "Agent: That's helpful. Do you have CNA, HHA, CPR, First Aid, reliable transportation, and are you willing to complete CHAMPS enrollment if the case requires it?",
      "Caller: I have reliable transportation, CPR is current, and I'm willing to do background check and CHAMPS paperwork. I prefer days but can do every other weekend if the client is close.",
      "Agent: Thank you. I captured your experience, certifications, availability, transportation, and CHAMPS readiness. A hiring coordinator will call you back with next steps and required documents.",
    ].join("\n\n");
  }

  if (seed.leadType === "other") {
    return [
      `Agent: Thank you for calling ${faker.helpers.arrayElement(agencyStyleNames)}. How can I help you today?`,
      `Caller: This is ${callerName}. I think I may have the wrong number, but I wanted to ask a quick question.`,
      "Agent: No problem. I can take a short message if needed.",
      `Caller: Please have someone call me back if this is the right office near ${seed.city}.`,
      "Agent: Thank you. I will pass the message along.",
    ].join("\n\n");
  }

  return [
    `Agent: Thank you for calling ${faker.helpers.arrayElement(agencyStyleNames)}. This is the AI intake assistant. If this is an emergency, please call 911. How can I help today?`,
    `Caller: Hi, my name is ${callerName}. I'm calling about ${subjectName}, ${subjectName.split(" ")[0]} lives in ${seed.city}. I'm the one trying to keep everything together for the family, and we need help at home pretty soon.`,
    `Agent: I can help get the right information to the intake team. What changed recently, and what kind of help is needed at home?`,
    `Caller: ${subjectName.split(" ")[0]} has ${seed.diagnosis}. The biggest things are bathing, dressing, meals, light housekeeping, and making sure ${subjectName.split(" ")[0]} doesn't fall when getting to the bathroom. There was a scare last week and my sister and I are taking turns, but we both work.`,
    "Agent: I understand. Do you know whether coverage is Medicaid Home Help, MI Choice, a health plan like Meridian, Medicare Advantage, private pay, or something still pending?",
    `Caller: I believe it's ${seed.payer ?? "not totally clear yet"}. Someone mentioned Meridian and Medicaid Home Help, but I don't know what forms are needed. We just need someone who can explain it without making us start over.`,
    "Agent: That makes sense. I captured the payer question, family caregiver situation, requested services, fall risk, and best callback need. What time should the intake coordinator call back?",
    "Caller: Afternoon is best, after 2 if possible. Please call this number. If I don't answer, leave a message because I may be at work or with my mom.",
    "Agent: Thank you. I will send this to the intake team with the urgency and payer details. A staff member will follow up to confirm eligibility, service hours, and next steps.",
  ].join("\n\n");
}

async function insertLead(seed: LeadSeed, index: number, counts: InsertCounts) {
  const contactName = fullName();
  const subjectName = fullName();
  const extraction =
    seed.leadType === "caregiver_applicant"
      ? caregiverExtraction(seed, contactName)
      : seed.leadType === "other"
        ? otherExtraction(seed, contactName)
        : clientExtraction(seed, subjectName, contactName);
  const firstContactAt = aliveDate(index, 1);
  const lastContactAt = aliveDate(index);

  const { data: lead, error: leadError } = await supabase
    .from("leads")
    .insert({
      tenant_id: tenantId,
      lead_type: seed.leadType,
      lead_status: seed.status,
      source: "phone_inbound",
      urgency: seed.urgency,
      first_contact_at: firstContactAt,
      last_contact_at: lastContactAt,
      notes: seed.note,
    })
    .select("id")
    .single();

  if (leadError || !lead) {
    throw new Error(`Unable to insert lead ${index}`);
  }

  counts.leads += 1;

  const contactCount = faker.number.int({ min: 1, max: 3 });
  const contacts = Array.from({ length: contactCount }).map((_, contactIndex) => ({
    tenant_id: tenantId,
    lead_id: lead.id,
    full_name: contactIndex === 0 ? contactName : fullName(),
    phone: syntheticPhone(index * 10 + contactIndex),
    email: contactIndex === 0 ? faker.internet.email().toLowerCase() : null,
    relationship_to_client: contactIndex === 0 ? extraction.contact.relationship_to_client : "adult_child",
    is_primary_contact: contactIndex === 0,
    preferred_contact_method: "phone",
    best_time_to_reach: "Afternoons",
  }));
  await supabase.from("contacts").insert(contacts);

  if ("prospective_client" in extraction) {
    await supabase.from("prospective_clients").insert({
      tenant_id: tenantId,
      lead_id: lead.id,
      ...extraction.prospective_client,
    });
  }

  if ("caregiver_applicant" in extraction) {
    await supabase.from("caregiver_applicants").insert({
      tenant_id: tenantId,
      lead_id: lead.id,
      ...extraction.caregiver_applicant,
    });
  }

  const callCount = seed.note.includes("WOW lead") ? 3 : faker.number.int({ min: 1, max: 4 });
  for (let callIndex = 0; callIndex < callCount; callIndex += 1) {
    const confidence = confidencePlan[(counts.calls + callIndex) % confidencePlan.length];
    await supabase.from("intake_calls").insert({
      tenant_id: tenantId,
      lead_id: lead.id,
      retell_call_id: `demo-${lead.id}-${callIndex}`,
      caller_phone: contacts[0].phone,
      caller_phone_normalized: contacts[0].phone,
      call_started_at: aliveDate(index, callIndex),
      call_ended_at: aliveDate(index, callIndex),
      duration_seconds: faker.number.int({ min: 240, max: 720 }),
      transcript: makeTranscript(seed, contactName, subjectName),
      disconnect_reason: "user_hangup",
      call_direction: "inbound",
      status: "merged_into_lead",
      extraction,
      extraction_confidence: seed.note.includes("WOW lead") ? "high" : confidence,
    });
  }
  counts.calls += callCount;

  const activityRows = [
    "Call received",
    "Caller contact captured",
    "Lead type classified",
    "Initial payer information captured",
    "Care needs summarized",
    `Status changed to ${seed.status}`,
    "Staff note added",
    "Follow-up reminder set",
  ].slice(0, faker.number.int({ min: 4, max: 8 }));

  await supabase.from("lead_activities").insert(
    activityRows.map((summary, activityIndex) => ({
      tenant_id: tenantId,
      lead_id: lead.id,
      activity_type:
        activityIndex === 0
          ? "call_received"
          : activityIndex === 5
            ? "status_change"
            : activityIndex === 6
              ? "note"
              : "field_updated",
      summary,
      detail: { synthetic: true },
      created_at: aliveDate(index, activityIndex),
    }))
  );
  counts.activities += activityRows.length;

  if (extraction.red_flags.length) {
    await supabase.from("lead_activities").insert({
      tenant_id: tenantId,
      lead_id: lead.id,
      activity_type: "flagged",
      summary: "Synthetic red flags captured",
      detail: { red_flags: extraction.red_flags },
    });
    counts.activities += 1;
  }
}

async function main() {
  const counts: InsertCounts = { leads: 0, calls: 0, activities: 0 };

  for (const [index, seed] of leadSeeds.entries()) {
    await insertLead(seed, index, counts);
  }

  process.stdout.write(
    `Inserted ${counts.leads} leads, ${counts.calls} calls, ${counts.activities} activities.\n`
  );
}

main().catch((error: unknown) => {
  process.stderr.write(
    error instanceof Error ? `${error.message}\n` : "Failed to seed demo data.\n"
  );
  process.exit(1);
});
