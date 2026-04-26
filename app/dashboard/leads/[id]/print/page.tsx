import { notFound } from "next/navigation";
import { z } from "zod";
import {
  activitySchema,
  contactSchema,
  leadSchema,
  recordSchema,
} from "@/app/dashboard/leads/[id]/types";
import { PrintButton } from "@/app/dashboard/leads/[id]/print/print-button";
import { getCurrentUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

type PageProps = {
  params: Promise<{
    id: string;
  }>;
};

const paramsSchema = z.object({
  id: z.uuid(),
});

const assignedProfileSchema = z
  .object({
    full_name: z.string().nullable(),
    email: z.string().nullable(),
  })
  .nullable()
  .optional();

type PrintValue = string | number | boolean | null | undefined | unknown[];
type PrintRecord = Record<string, unknown>;

function display(value: PrintValue) {
  if (value === null || value === undefined || value === "") {
    return "Not assessed";
  }

  if (Array.isArray(value)) {
    return value.length ? value.join(", ") : "Not assessed";
  }

  if (typeof value === "boolean") {
    return value ? "Yes" : "No";
  }

  return String(value).replaceAll("_", " ");
}

function date(value: string | null | undefined) {
  return value
    ? new Intl.DateTimeFormat("en-US", { dateStyle: "medium" }).format(
        new Date(value)
      )
    : "Not assessed";
}

function section(title: string, children: React.ReactNode) {
  return (
    <section className="break-inside-avoid border border-neutral-900">
      <h2 className="border-b border-neutral-900 bg-neutral-100 px-2 py-1 text-[10.5pt] font-bold tracking-wide">
        {title}
      </h2>
      <div className="p-2">{children}</div>
    </section>
  );
}

function field(label: string, value: PrintValue) {
  return (
    <div className="grid grid-cols-[10rem_1fr] border-b border-neutral-200 py-0.5 last:border-b-0">
      <dt className="text-[8pt] font-semibold uppercase tracking-wide text-neutral-600">{label}</dt>
      <dd>{display(value)}</dd>
    </div>
  );
}

function fieldGrid(items: [string, PrintValue][]) {
  return (
    <dl className="grid gap-x-4 md:grid-cols-2 print:grid-cols-2">
      {items.map(([label, value]) => (
        <div key={label}>{field(label, value)}</div>
      ))}
    </dl>
  );
}

function get(record: PrintRecord | null, key: string) {
  return record?.[key] as PrintValue;
}

function adlGrid(record: PrintRecord | null, rows: [string, string][]) {
  return (
    <table className="w-full border-collapse text-left">
      <thead>
        <tr>
          <th className="border border-neutral-500 px-2 py-1">Task</th>
          <th className="border border-neutral-500 px-2 py-1">Assessment</th>
        </tr>
      </thead>
      <tbody>
        {rows.map(([key, label]) => (
          <tr key={key}>
            <td className="border border-neutral-500 px-2 py-1 font-semibold">
              {label}
            </td>
            <td className="border border-neutral-500 px-2 py-1">
              {display(get(record, key))}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export default async function PrintLeadPage({ params }: PageProps) {
  const parsed = paramsSchema.safeParse(await params);

  if (!parsed.success) {
    notFound();
  }

  const { profile, tenant } = await getCurrentUser();
  const supabase = await createClient();
  const [
    leadResult,
    contactsResult,
    clientResult,
    caregiverResult,
    activitiesResult,
  ] =
    await Promise.all([
      supabase
        .from("leads")
        .select("*, profiles!leads_assigned_to_tenant_fk(full_name, email)")
        .eq("id", parsed.data.id)
        .eq("tenant_id", profile.tenant_id)
        .single(),
      supabase
        .from("contacts")
        .select("*")
        .eq("lead_id", parsed.data.id)
        .eq("tenant_id", profile.tenant_id)
        .order("is_primary_contact", { ascending: false })
        .order("created_at", { ascending: true }),
      supabase
        .from("prospective_clients")
        .select("*")
        .eq("lead_id", parsed.data.id)
        .eq("tenant_id", profile.tenant_id)
        .maybeSingle(),
      supabase
        .from("caregiver_applicants")
        .select("*")
        .eq("lead_id", parsed.data.id)
        .eq("tenant_id", profile.tenant_id)
        .maybeSingle(),
      supabase
        .from("lead_activities")
        .select("id, activity_type, summary, detail, created_at, profiles(full_name, email)")
        .eq("lead_id", parsed.data.id)
        .eq("tenant_id", profile.tenant_id)
        .order("created_at", { ascending: false })
        .limit(10),
    ]);

  if (leadResult.error || !leadResult.data) {
    notFound();
  }

  const lead = leadSchema.parse(leadResult.data);
  const assignedProfile = assignedProfileSchema.parse(
    "profiles" in leadResult.data ? leadResult.data.profiles : null
  );
  const contacts = z.array(contactSchema).parse(contactsResult.data ?? []);
  const client = recordSchema.parse(clientResult.data);
  const caregiver = recordSchema.parse(caregiverResult.data);
  const activities = z.array(activitySchema).parse(activitiesResult.data ?? []);
  const isClientLead =
    lead.lead_type === "client_referral" || lead.lead_type === "existing_client";

  return (
    <main className="mx-auto max-w-[8.5in] bg-white p-6 text-[10.5pt] leading-tight text-black print:m-0 print:max-w-none print:p-0">
      <style>
        {`
          @page { size: letter; margin: 0.5in; }
          @media print {
            body, main { font-family: Cambria, "Source Serif 4", Georgia, "Times New Roman", serif; font-size: 10.5pt; line-height: 1.16; background: white; color: black; }
            body > *:not(main), nav, aside, header[data-dashboard-header] { display: none !important; }
            section { break-inside: avoid; page-break-inside: avoid; margin-bottom: 0.09in; }
            .print-footer { position: fixed; bottom: -0.25in; left: 0; right: 0; font-size: 8pt; color: #333; border-top: 1px solid #222; padding-top: 0.05in; }
            .print-footer::after { content: "Page " counter(page) " of " counter(pages); float: right; }
            .no-print { display: none !important; }
          }
        `}
      </style>

      <div className="mb-3 flex items-start justify-between gap-4 border-b border-neutral-900 pb-2 print:mb-2">
        <header className="flex gap-3">
          <div className="grid size-14 place-items-center border border-neutral-900 text-[8pt] font-bold uppercase">
            Logo
          </div>
          <div>
            <p className="text-[14pt] font-bold">{tenant.name}</p>
            <p className="text-[9pt]">{tenant.agency_address ?? "Agency address not set"}</p>
            <p className="text-[9pt]">{tenant.agency_phone ?? "Agency phone not set"}</p>
            <h1 className="mt-2 text-[16pt] font-bold uppercase tracking-wide">
              Intake Packet
            </h1>
            <p className="font-mono text-[8pt]">Lead ID: {lead.id}</p>
            <p className="text-[8pt]">Generated: {new Date().toLocaleString()}</p>
          </div>
        </header>
        <div className="no-print">
          <PrintButton />
        </div>
      </div>

      <div className="grid gap-3">
        {section(
          "1. Lead Summary",
          fieldGrid([
            ["Type", lead.lead_type],
            ["Status", lead.lead_status],
            ["Urgency", lead.urgency],
            ["Source", lead.source],
            ["Assigned to", assignedProfile?.full_name ?? assignedProfile?.email],
            ["First contact", date(lead.first_contact_at)],
            ["Last contact", date(lead.last_contact_at)],
            ["Next follow-up", date(lead.next_followup_at)],
          ])
        )}

        {section(
          "2. Contact Information",
          contacts.length ? (
            <div className="grid gap-2">
              {contacts.map((contact, index) => (
                <article key={contact.id} className="border border-neutral-300 p-2">
                  <h3 className="mb-1 font-bold">
                    Contact {index + 1}
                    {contact.is_primary_contact ? " (Primary)" : ""}
                  </h3>
                  {fieldGrid([
                    ["Name", contact.full_name],
                    ["Phone", contact.phone],
                    ["Alt phone", contact.phone_alt],
                    ["Email", contact.email],
                    ["Relationship", contact.relationship_to_client],
                    ["POA", contact.is_poa],
                    ["Emergency contact", contact.is_emergency_contact],
                    ["Preferred method", contact.preferred_contact_method],
                    ["Best time", contact.best_time_to_reach],
                    ["Notes", contact.notes],
                  ])}
                </article>
              ))}
            </div>
          ) : (
            <p>No contacts recorded.</p>
          )
        )}

        {isClientLead
          ? section(
              "3. Client Demographics",
              fieldGrid([
                ["First name", get(client, "first_name")],
                ["Last name", get(client, "last_name")],
                ["Preferred name", get(client, "preferred_name")],
                ["DOB", get(client, "date_of_birth")],
                ["Age", get(client, "age")],
                ["Gender", get(client, "gender")],
                ["Marital status", get(client, "marital_status")],
                ["Primary language", get(client, "primary_language")],
                ["Interpreter needed", get(client, "requires_interpreter")],
                ["Interpreter language", get(client, "interpreter_language")],
                ["Ethnicity", get(client, "ethnicity")],
                ["Veteran", get(client, "veteran_status")],
              ])
            )
          : null}

        {isClientLead
          ? section(
              "4. Address & Living Situation",
              fieldGrid([
                ["Street", get(client, "address_street")],
                ["Unit", get(client, "address_unit")],
                ["City", get(client, "address_city")],
                ["State", get(client, "address_state")],
                ["ZIP", get(client, "address_zip")],
                ["County", get(client, "county")],
                ["Lives with", get(client, "lives_with")],
                ["Home type", get(client, "home_type")],
                ["Stairs to enter", get(client, "stairs_to_enter")],
                ["Pets", get(client, "pets_in_home")],
                ["Smoking", get(client, "smoking_in_home")],
                ["Safety concerns", get(client, "home_safety_concerns")],
              ])
            )
          : null}

        {isClientLead
          ? section(
              "5. Identifiers & PCP",
              fieldGrid([
                ["Medicaid ID", get(client, "medicaid_id")],
                ["Medicare ID", get(client, "medicare_id")],
                ["SSN last 4", get(client, "ssn_last4")],
                ["Receives SS benefits", get(client, "ss_benefits_receiving")],
                ["Has PCP", get(client, "has_pcp")],
                ["PCP name", get(client, "pcp_name")],
                ["PCP phone", get(client, "pcp_phone")],
                ["PCP practice", get(client, "pcp_practice")],
                ["Recent hospitalization", get(client, "recent_hospitalization")],
                ["Hospital detail", get(client, "recent_hospitalization_detail")],
              ])
            )
          : null}

        {isClientLead
          ? section(
              "6. Payer & Coverage",
              fieldGrid([
                ["Primary payer", get(client, "primary_payer")],
                ["MCO plan", get(client, "mco_plan_name")],
                ["Medicaid active", get(client, "medicaid_active")],
                ["Medicaid pending", get(client, "medicaid_pending")],
                ["MI Choice Waiver", get(client, "has_mi_choice_waiver")],
                ["Medicare Advantage", get(client, "has_medicare_advantage")],
                ["LTC carrier", get(client, "ltc_policy_carrier")],
                ["VA benefits", get(client, "va_benefits")],
                ["Private-pay budget", get(client, "estimated_monthly_budget_private_pay")],
              ])
            )
          : null}

        {isClientLead
          ? section(
              "7. ADL Assessment",
              adlGrid(client, [
                ["adl_bathing", "Bathing"],
                ["adl_dressing", "Dressing"],
                ["adl_grooming", "Grooming"],
                ["adl_toileting", "Toileting"],
                ["adl_transferring", "Transferring"],
                ["adl_eating", "Eating/Feeding"],
              ])
            )
          : null}

        {isClientLead
          ? section(
              "8. IADL Assessment",
              adlGrid(client, [
                ["iadl_meal_prep", "Meal prep"],
                ["iadl_light_housework", "Light housework"],
                ["iadl_laundry", "Laundry"],
                ["iadl_shopping", "Shopping"],
                ["iadl_medication_reminders", "Medication reminders"],
                ["iadl_transportation", "Transportation"],
              ])
            )
          : null}

        {isClientLead
          ? section(
              "9. Continence, Mobility & Equipment",
              fieldGrid([
                ["Bladder", get(client, "continence_bladder")],
                ["Bowel", get(client, "continence_bowel")],
                ["Mobility", get(client, "mobility_status")],
                ["Oxygen", get(client, "uses_oxygen")],
                ["Fall risk", get(client, "fall_risk")],
                ["Falls last 90 days", get(client, "falls_last_90_days")],
                ["Equipment", get(client, "medical_equipment")],
              ])
            )
          : null}

        {isClientLead
          ? section(
              "10. Cognitive, Behavioral, Mental Health",
              fieldGrid([
                ["Cognitive status", get(client, "cognitive_status")],
                ["Dementia diagnosis", get(client, "has_dementia_diagnosis")],
                ["Behavioral concerns", get(client, "behavioral_concerns")],
                ["Mental health history", get(client, "mental_health_history")],
              ])
            )
          : null}

        {isClientLead
          ? section(
              "11. Diagnoses & Medications",
              fieldGrid([
                ["Primary diagnosis", get(client, "primary_diagnosis")],
                ["Secondary diagnoses", get(client, "secondary_diagnoses")],
                ["Medication count", get(client, "medications_count")],
                ["Medication list", get(client, "medication_list")],
              ])
            )
          : null}

        {isClientLead
          ? section(
              "12. Requested Services & Preferences",
              fieldGrid([
                ["Requested services", get(client, "requested_services")],
                ["Hours/week", get(client, "requested_hours_per_week")],
                ["Start date", get(client, "requested_start_date")],
                ["Preferred schedule", get(client, "preferred_schedule")],
                ["Caregiver gender", get(client, "preferred_caregiver_gender")],
                ["Caregiver language", get(client, "preferred_caregiver_language")],
                ["Caregiver notes", get(client, "caregiver_notes")],
              ])
            )
          : null}

        {isClientLead
          ? section(
              "13. Existing Care Situation",
              fieldGrid([
                ["Family caregiver available", get(client, "family_caregiver_available")],
                ["Relationship", get(client, "family_caregiver_relationship")],
                ["Wants to be paid", get(client, "family_caregiver_wants_to_be_paid")],
                ["Currently receiving services", get(client, "currently_receiving_services")],
                ["Current agency", get(client, "current_agency_name")],
                ["Reason for change", get(client, "reason_for_change")],
              ])
            )
          : null}

        {lead.lead_type === "caregiver_applicant"
          ? section(
              "14. Caregiver Applicant Summary",
              fieldGrid([
                ["First name", get(caregiver, "first_name")],
                ["Last name", get(caregiver, "last_name")],
                ["Phone", get(caregiver, "phone")],
                ["Email", get(caregiver, "email")],
                ["City", get(caregiver, "address_city")],
                ["State", get(caregiver, "address_state")],
                ["ZIP", get(caregiver, "address_zip")],
                ["DOB", get(caregiver, "date_of_birth")],
                ["Driver license", get(caregiver, "has_drivers_license")],
                ["Reliable transportation", get(caregiver, "has_reliable_transportation")],
                ["Travel miles", get(caregiver, "willing_to_travel_miles")],
                ["Years experience", get(caregiver, "years_experience")],
                ["Experience types", get(caregiver, "experience_types")],
                ["CNA", get(caregiver, "cna_certified")],
                ["HHA", get(caregiver, "hha_certified")],
                ["CPR", get(caregiver, "cpr_certified")],
                ["First Aid", get(caregiver, "first_aid_certified")],
                ["Languages", get(caregiver, "languages_spoken")],
                ["Hours sought", get(caregiver, "hours_per_week_sought")],
                ["Availability", get(caregiver, "availability")],
                ["Been in CHAMPS", get(caregiver, "has_been_in_champs")],
                ["Willing CHAMPS", get(caregiver, "willing_to_enroll_in_champs")],
                ["Referred by", get(caregiver, "referred_by")],
                ["Relative relationship", get(caregiver, "relationship_to_prospective_client")],
                ["Background check", get(caregiver, "willing_background_check")],
                ["Application status", get(caregiver, "status")],
                ["Notes", get(caregiver, "notes")],
              ])
            )
          : null}

        {section(
          "15. Activity Summary",
          activities.length ? (
            <ol className="grid gap-1">
              {activities.map((activity) => (
                <li key={activity.id} className="border-b border-neutral-200 pb-1">
                  <span className="font-semibold">{date(activity.created_at)}:</span>{" "}
                  {activity.activity_type.replaceAll("_", " ")} - {activity.summary}
                </li>
              ))}
            </ol>
          ) : (
            <p>No activities recorded.</p>
          )
        )}
      </div>

      <footer className="mt-4 border-t border-neutral-900 pt-2 text-[8pt]">
        This intake packet is a preliminary record. Eligibility and authorized
        hours are determined by MDHHS / the applicable payer. Not a clinical
        assessment.
      </footer>
      <div className="print-footer">
        Lead ID: {lead.id} · Generated: {new Date().toLocaleString()}
      </div>
    </main>
  );
}
