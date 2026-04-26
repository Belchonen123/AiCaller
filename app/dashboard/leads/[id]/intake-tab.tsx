"use client";

import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import {
  BathIcon,
  CarIcon,
  ChevronDownIcon,
  ClipboardListIcon,
  CookingPotIcon,
  DropletIcon,
  DumbbellIcon,
  HomeIcon,
  LinkIcon,
  PillIcon,
  ShirtIcon,
  ShoppingCartIcon,
  SparklesIcon,
  UtensilsIcon,
  WashingMachineIcon,
} from "lucide-react";
import {
  markIntakeComplete,
  updateCaregiverApplicantField,
  updateProspectiveClientField,
} from "@/app/dashboard/leads/[id]/actions";
import {
  adlFields,
  adlLevels,
  caregiverStatuses,
  clientRequiredFields,
  iadlFields,
  iadlLevels,
  primaryPayers,
  requestedServices,
} from "@/app/dashboard/leads/[id]/lead-config";
import type { DetailRecord, Lead } from "@/app/dashboard/leads/[id]/types";
import {
  AutoSaveCheckbox,
  AutoSaveCheckboxGroup,
  AutoSaveField,
  AutoSaveSelect,
  type FieldValue,
} from "@/app/dashboard/leads/[id]/field-components";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

const formValueSchema = z.record(
  z.string(),
  z.union([z.string(), z.number(), z.boolean(), z.array(z.string()), z.null()])
);

const clientCompletionSchema = z.object({
  first_name: z.string().min(1),
  last_name: z.string().min(1),
  date_of_birth: z.string().min(1),
  address_street: z.string().min(1),
  address_city: z.string().min(1),
  address_zip: z.string().min(1),
  primary_payer: z.string().min(1),
});

const caregiverCompletionSchema = z.object({
  first_name: z.string().min(1),
  last_name: z.string().min(1),
  phone: z.string().min(1),
  status: z.string().min(1),
});

const textOrNull = (record: DetailRecord | null, field: string) => {
  const value = record?.[field];
  return typeof value === "string" || typeof value === "number" ? value : "";
};

const boolOrNull = (record: DetailRecord | null, field: string) => record?.[field] === true;

function Section({
  id,
  title,
  children,
  defaultOpen = false,
  completed = 0,
  total = 0,
}: {
  id: string;
  title: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
  completed?: number;
  total?: number;
}) {
  async function copyAnchor() {
    await navigator.clipboard.writeText(`${window.location.href.split("#")[0]}#${id}`);
    toast.success("Section link copied.");
  }

  return (
    <details
      id={id}
      open={defaultOpen}
      className="group rounded-xl border border-border-default bg-bg-surface open:shadow-sm"
    >
      <summary className="flex cursor-pointer list-none items-center gap-3 border-b border-transparent p-4 text-base font-semibold group-open:border-border-subtle">
        <span className="min-w-0 flex-1">{title}</span>
        <span className="text-xs font-medium text-fg-tertiary">
          {completed} of {total} fields
        </span>
        <button
          type="button"
          onClick={(event) => {
            event.preventDefault();
            copyAnchor();
          }}
          className="rounded-md p-1 text-fg-tertiary hover:bg-bg-muted"
          aria-label={`Copy ${title} section link`}
        >
          <LinkIcon className="size-4" />
        </button>
        <ChevronDownIcon className="size-4 text-fg-tertiary transition-transform group-open:rotate-180" />
      </summary>
      <div className="mt-4 grid gap-4">{children}</div>
    </details>
  );
}

function FieldGrid({ children }: { children: React.ReactNode }) {
  return <div className="grid gap-4 md:grid-cols-2">{children}</div>;
}

function completion(record: DetailRecord | null, fields: readonly string[]) {
  return fields.filter((field) => {
    const value = record?.[field];
    return value !== null && value !== undefined && value !== "";
  }).length;
}

function AssistanceGrid({
  rows,
  levels,
  record,
  onSave,
}: {
  rows: readonly (readonly [string, string])[];
  levels: readonly (readonly [string, string])[];
  record: DetailRecord | null;
  onSave: (field: string, value: FieldValue) => Promise<{ ok: boolean; message: string }>;
}) {
  return (
    <div className="grid gap-2">
        {rows.map(([field, label]) => {
          const value = textOrNull(record, field);
          const Icon = assistanceIcon(field);

          return (
            <div
              key={field}
              className={cn(
                "grid gap-3 rounded-lg border-l-4 border-y border-r bg-bg-surface p-3 lg:grid-cols-[12rem_1fr]",
                assistanceBorder(value)
              )}
              data-field={field}
            >
              <Label className="flex items-center gap-2">
                <Icon className="size-4 text-fg-tertiary" />
                {label}
              </Label>
              <div className="flex flex-wrap gap-1.5">
                {levels.map(([level, levelLabel]) => (
                  <button
                    key={level}
                    type="button"
                    onClick={() => onSave(field, level)}
                    className={cn(
                      "h-8 rounded-md border border-border-default px-2.5 text-xs font-medium text-fg-secondary hover:bg-bg-muted focus-visible:shadow-focus",
                      value === level && "border-accent-primary bg-bg-emphasis text-fg-primary"
                    )}
                  >
                    {levelLabel}
                  </button>
                ))}
              </div>
            </div>
          );
        })}
    </div>
  );
}

function assistanceBorder(value: string | number) {
  if (value === "independent") return "border-l-success-fg";
  if (value === "supervision" || value === "needs_help") return "border-l-info-fg";
  if (value === "partial_assist") return "border-l-warning-fg";
  if (value === "total_assist") return "border-l-danger-fg bg-danger-bg";
  return "border-l-border-default";
}

function assistanceIcon(field: string) {
  if (field.includes("bathing")) return DropletIcon;
  if (field.includes("dressing")) return ShirtIcon;
  if (field.includes("grooming")) return SparklesIcon;
  if (field.includes("toileting")) return BathIcon;
  if (field.includes("transferring")) return DumbbellIcon;
  if (field.includes("eating")) return UtensilsIcon;
  if (field.includes("meal")) return CookingPotIcon;
  if (field.includes("housework")) return HomeIcon;
  if (field.includes("laundry")) return WashingMachineIcon;
  if (field.includes("shopping")) return ShoppingCartIcon;
  if (field.includes("medication")) return PillIcon;
  if (field.includes("transportation")) return CarIcon;
  return ClipboardListIcon;
}

export function IntakeTab({
  lead,
  prospectiveClient,
  caregiverApplicant,
}: {
  lead: Lead;
  prospectiveClient: DetailRecord | null;
  caregiverApplicant: DetailRecord | null;
}) {
  if (lead.lead_type === "caregiver_applicant") {
    return (
      <CaregiverIntakeForm lead={lead} caregiverApplicant={caregiverApplicant} />
    );
  }

  return <ClientIntakeForm lead={lead} prospectiveClient={prospectiveClient} />;
}

function ClientIntakeForm({
  lead,
  prospectiveClient,
}: {
  lead: Lead;
  prospectiveClient: DetailRecord | null;
}) {
  const form = useForm<Record<string, FieldValue>>({
    resolver: zodResolver(formValueSchema),
    defaultValues: Object.fromEntries(
      Object.entries(prospectiveClient ?? {}).map(([key, value]) => [
        key,
        Array.isArray(value) ||
        typeof value === "string" ||
        typeof value === "number" ||
        typeof value === "boolean"
          ? value
          : null,
      ])
    ),
  });

  async function save(field: string, value: FieldValue) {
    form.setValue(field, value, { shouldValidate: true });
    return updateProspectiveClientField({ leadId: lead.id, field, value });
  }

  async function complete() {
    const values = form.getValues();
    const parsed = clientCompletionSchema.safeParse(values);
    const hasAdl = adlFields.some(([field]) => Boolean(values[field]));

    if (!parsed.success || !hasAdl) {
      const firstMissing =
        clientRequiredFields.find((field) => !values[field]) ??
        (!hasAdl ? adlFields[0][0] : null);
      if (firstMissing) {
        document.querySelector(`[data-field="${firstMissing}"]`)?.scrollIntoView({
          behavior: "smooth",
          block: "center",
        });
      }
      toast.error("Complete required intake fields before marking done.");
      return;
    }

    const result = await markIntakeComplete({ leadId: lead.id });
    if (result.ok) {
      toast.success(result.message);
    } else {
      toast.error(result.message);
    }
  }

  return (
    <div className="grid gap-4">
      <Section
        id="demographics"
        title="Demographics"
        defaultOpen
        completed={completion(prospectiveClient, ["first_name", "last_name", "date_of_birth", "preferred_name", "age", "gender", "marital_status", "primary_language", "requires_interpreter", "interpreter_language", "veteran_status", "ethnicity"])}
        total={12}
      >
        <FieldGrid>
          <AutoSaveField field="first_name" label="First name" required value={textOrNull(prospectiveClient, "first_name")} onSave={save} />
          <AutoSaveField field="last_name" label="Last name" required value={textOrNull(prospectiveClient, "last_name")} onSave={save} />
          <AutoSaveField field="preferred_name" label="Preferred name" value={textOrNull(prospectiveClient, "preferred_name")} onSave={save} />
          <AutoSaveField field="date_of_birth" label="DOB" type="date" required value={textOrNull(prospectiveClient, "date_of_birth")} onSave={save} />
          <AutoSaveField field="age" label="Age" type="number" value={textOrNull(prospectiveClient, "age")} onSave={save} />
          <AutoSaveSelect field="gender" label="Gender" value={textOrNull(prospectiveClient, "gender")} options={[["male", "Male"], ["female", "Female"], ["nonbinary", "Nonbinary"], ["prefer_not_to_say", "Prefer not to say"], ["unknown", "Unknown"]]} onSave={save} />
          <AutoSaveSelect field="marital_status" label="Marital status" value={textOrNull(prospectiveClient, "marital_status")} options={[["single", "Single"], ["married", "Married"], ["partnered", "Partnered"], ["divorced", "Divorced"], ["widowed", "Widowed"], ["separated", "Separated"], ["unknown", "Unknown"]]} onSave={save} />
          <AutoSaveField field="primary_language" label="Primary language" value={textOrNull(prospectiveClient, "primary_language")} onSave={save} />
          <AutoSaveCheckbox field="requires_interpreter" label="Requires interpreter" value={boolOrNull(prospectiveClient, "requires_interpreter")} onSave={save} />
          <AutoSaveField field="interpreter_language" label="Interpreter language" value={textOrNull(prospectiveClient, "interpreter_language")} onSave={save} />
          <AutoSaveCheckbox field="veteran_status" label="Veteran status" value={boolOrNull(prospectiveClient, "veteran_status")} onSave={save} />
          <AutoSaveField field="ethnicity" label="Ethnicity" value={textOrNull(prospectiveClient, "ethnicity")} onSave={save} />
        </FieldGrid>
      </Section>
      <Section
        id="address-living"
        title="Address & Living Situation"
        defaultOpen
        completed={completion(prospectiveClient, ["address_street", "address_unit", "address_city", "address_state", "address_zip", "county", "lives_with", "home_type", "stairs_to_enter", "pets_in_home", "smoking_in_home", "home_safety_concerns"])}
        total={12}
      >
        <FieldGrid>
          <AutoSaveField field="address_street" label="Street" required value={textOrNull(prospectiveClient, "address_street")} onSave={save} />
          <AutoSaveField field="address_unit" label="Unit" value={textOrNull(prospectiveClient, "address_unit")} onSave={save} />
          <AutoSaveField field="address_city" label="City" required value={textOrNull(prospectiveClient, "address_city")} onSave={save} />
          <AutoSaveField field="address_state" label="State" value={textOrNull(prospectiveClient, "address_state") || "MI"} onSave={save} />
          <AutoSaveField field="address_zip" label="ZIP" required value={textOrNull(prospectiveClient, "address_zip")} onSave={save} />
          <AutoSaveField field="county" label="County" value={textOrNull(prospectiveClient, "county")} onSave={save} />
          <AutoSaveField field="lives_with" label="Lives with" value={textOrNull(prospectiveClient, "lives_with")} onSave={save} />
          <AutoSaveSelect field="home_type" label="Home type" value={textOrNull(prospectiveClient, "home_type")} options={[["house", "House"], ["apartment", "Apartment"], ["condo", "Condo"], ["mobile_home", "Mobile home"], ["assisted_living", "Assisted living"], ["adult_foster_care", "Adult foster care"], ["group_home", "Group home"], ["family_home", "Family home"], ["other", "Other"], ["unknown", "Unknown"]]} onSave={save} />
          <AutoSaveCheckbox field="stairs_to_enter" label="Stairs to enter" value={boolOrNull(prospectiveClient, "stairs_to_enter")} onSave={save} />
          <AutoSaveField field="pets_in_home" label="Pets" value={textOrNull(prospectiveClient, "pets_in_home")} onSave={save} />
          <AutoSaveCheckbox field="smoking_in_home" label="Smoking in home" value={boolOrNull(prospectiveClient, "smoking_in_home")} onSave={save} />
          <AutoSaveField field="home_safety_concerns" label="Home safety concerns" type="textarea" value={textOrNull(prospectiveClient, "home_safety_concerns")} onSave={save} />
        </FieldGrid>
      </Section>
      <Section id="identifiers-pcp" title="Identifiers & PCP" completed={completion(prospectiveClient, ["medicaid_id", "medicare_id", "ssn_last4", "ss_benefits_receiving", "has_pcp", "pcp_name", "pcp_phone", "pcp_practice", "recent_hospitalization", "recent_hospitalization_detail"])} total={10}>
        <FieldGrid>
          <AutoSaveField field="medicaid_id" label="Medicaid ID" value={textOrNull(prospectiveClient, "medicaid_id")} onSave={save} />
          <AutoSaveField field="medicare_id" label="Medicare ID" value={textOrNull(prospectiveClient, "medicare_id")} onSave={save} />
          <AutoSaveField field="ssn_last4" label="SSN last 4" masked value={textOrNull(prospectiveClient, "ssn_last4")} onSave={save} />
          <AutoSaveCheckbox field="ss_benefits_receiving" label="Receives Social Security benefits" value={boolOrNull(prospectiveClient, "ss_benefits_receiving")} onSave={save} />
          <AutoSaveCheckbox field="has_pcp" label="Has PCP" value={boolOrNull(prospectiveClient, "has_pcp")} onSave={save} />
          <AutoSaveField field="pcp_name" label="PCP name" value={textOrNull(prospectiveClient, "pcp_name")} onSave={save} />
          <AutoSaveField field="pcp_phone" label="PCP phone" value={textOrNull(prospectiveClient, "pcp_phone")} onSave={save} />
          <AutoSaveField field="pcp_practice" label="PCP practice" value={textOrNull(prospectiveClient, "pcp_practice")} onSave={save} />
          <AutoSaveCheckbox field="recent_hospitalization" label="Recent hospitalization" value={boolOrNull(prospectiveClient, "recent_hospitalization")} onSave={save} />
          <AutoSaveField field="recent_hospitalization_detail" label="Hospitalization detail" type="textarea" value={textOrNull(prospectiveClient, "recent_hospitalization_detail")} onSave={save} />
        </FieldGrid>
      </Section>
      <Section id="coverage-payer" title="Coverage & Payer" completed={completion(prospectiveClient, ["primary_payer", "mco_plan_name", "medicaid_active", "medicaid_pending", "has_mi_choice_waiver", "has_medicare_advantage", "ltc_policy_carrier", "va_benefits", "estimated_monthly_budget_private_pay"])} total={9}>
        <FieldGrid>
          <AutoSaveSelect field="primary_payer" label="Primary payer" value={textOrNull(prospectiveClient, "primary_payer")} options={primaryPayers} onSave={save} />
          <AutoSaveField field="mco_plan_name" label="MCO plan" value={textOrNull(prospectiveClient, "mco_plan_name")} onSave={save} />
          <AutoSaveCheckbox field="medicaid_active" label="Medicaid active" value={boolOrNull(prospectiveClient, "medicaid_active")} onSave={save} />
          <AutoSaveCheckbox field="medicaid_pending" label="Medicaid pending" value={boolOrNull(prospectiveClient, "medicaid_pending")} onSave={save} />
          <AutoSaveCheckbox field="has_mi_choice_waiver" label="MI Choice Waiver" value={boolOrNull(prospectiveClient, "has_mi_choice_waiver")} onSave={save} />
          <AutoSaveCheckbox field="has_medicare_advantage" label="Medicare Advantage" value={boolOrNull(prospectiveClient, "has_medicare_advantage")} onSave={save} />
          <AutoSaveField field="ltc_policy_carrier" label="LTC carrier" value={textOrNull(prospectiveClient, "ltc_policy_carrier")} onSave={save} />
          <AutoSaveCheckbox field="va_benefits" label="VA benefits" value={boolOrNull(prospectiveClient, "va_benefits")} onSave={save} />
          <AutoSaveField field="estimated_monthly_budget_private_pay" label="Private-pay budget estimate" type="number" value={textOrNull(prospectiveClient, "estimated_monthly_budget_private_pay")} onSave={save} />
        </FieldGrid>
      </Section>
      <Section id="adl-assessment" title="ADL Assessment" completed={completion(prospectiveClient, adlFields.map(([field]) => field))} total={6}>
        <AssistanceGrid rows={adlFields} levels={adlLevels} record={prospectiveClient} onSave={save} />
      </Section>
      <Section id="iadl-assessment" title="IADL Assessment" completed={completion(prospectiveClient, iadlFields.map(([field]) => field))} total={6}>
        <AssistanceGrid rows={iadlFields} levels={iadlLevels} record={prospectiveClient} onSave={save} />
      </Section>
      <Section id="continence" title="Continence" completed={completion(prospectiveClient, ["continence_bladder", "continence_bowel"])} total={2}>
        <FieldGrid>
          <AutoSaveSelect field="continence_bladder" label="Bladder" value={textOrNull(prospectiveClient, "continence_bladder")} options={[["continent", "Continent"], ["occasional_incontinence", "Occasional"], ["frequent_incontinence", "Frequent"], ["total_incontinence", "Total"], ["catheter", "Catheter"], ["ostomy", "Ostomy"], ["unknown", "Unknown"]]} onSave={save} />
          <AutoSaveSelect field="continence_bowel" label="Bowel" value={textOrNull(prospectiveClient, "continence_bowel")} options={[["continent", "Continent"], ["occasional_incontinence", "Occasional"], ["frequent_incontinence", "Frequent"], ["total_incontinence", "Total"], ["ostomy", "Ostomy"], ["unknown", "Unknown"]]} onSave={save} />
        </FieldGrid>
      </Section>
      <Section id="mobility-equipment" title="Mobility & Equipment" completed={completion(prospectiveClient, ["mobility_status", "uses_oxygen", "fall_risk", "falls_last_90_days", "medical_equipment"])} total={5}>
        <FieldGrid>
          <AutoSaveSelect field="mobility_status" label="Mobility" value={textOrNull(prospectiveClient, "mobility_status")} options={[["ambulatory", "Ambulatory"], ["cane", "Cane"], ["walker", "Walker"], ["wheelchair_manual", "Manual wheelchair"], ["wheelchair_power", "Power wheelchair"], ["bed_bound", "Bed bound"], ["unknown", "Unknown"]]} onSave={save} />
          <AutoSaveCheckbox field="uses_oxygen" label="Uses oxygen" value={boolOrNull(prospectiveClient, "uses_oxygen")} onSave={save} />
          <AutoSaveCheckbox field="fall_risk" label="Fall risk" value={boolOrNull(prospectiveClient, "fall_risk")} onSave={save} />
          <AutoSaveField field="falls_last_90_days" label="Falls in last 90 days" type="number" value={textOrNull(prospectiveClient, "falls_last_90_days")} onSave={save} />
          <AutoSaveField field="medical_equipment" label="Equipment list" type="textarea" value={textOrNull(prospectiveClient, "medical_equipment")} onSave={save} />
        </FieldGrid>
      </Section>
      <Section id="cognitive-behavioral" title="Cognitive & Behavioral" completed={completion(prospectiveClient, ["cognitive_status", "has_dementia_diagnosis", "behavioral_concerns", "mental_health_history"])} total={4}>
        <FieldGrid>
          <AutoSaveSelect field="cognitive_status" label="Cognitive status" value={textOrNull(prospectiveClient, "cognitive_status")} options={[["intact", "Intact"], ["mild_impairment", "Mild"], ["moderate_impairment", "Moderate"], ["severe_impairment", "Severe"], ["unknown", "Unknown"]]} onSave={save} />
          <AutoSaveCheckbox field="has_dementia_diagnosis" label="Dementia diagnosis" value={boolOrNull(prospectiveClient, "has_dementia_diagnosis")} onSave={save} />
          <AutoSaveField field="behavioral_concerns" label="Behavioral concerns" type="textarea" value={textOrNull(prospectiveClient, "behavioral_concerns")} onSave={save} />
          <AutoSaveField field="mental_health_history" label="Mental health history" type="textarea" value={textOrNull(prospectiveClient, "mental_health_history")} onSave={save} />
        </FieldGrid>
      </Section>
      <Section id="diagnoses-medications" title="Diagnoses & Medications" completed={completion(prospectiveClient, ["primary_diagnosis", "secondary_diagnoses", "medications_count", "medication_list"])} total={4}>
        <FieldGrid>
          <AutoSaveField field="primary_diagnosis" label="Primary diagnosis" value={textOrNull(prospectiveClient, "primary_diagnosis")} onSave={save} />
          <AutoSaveField field="secondary_diagnoses" label="Secondary diagnoses" type="textarea" value={textOrNull(prospectiveClient, "secondary_diagnoses")} onSave={save} />
          <AutoSaveField field="medications_count" label="Medication count" type="number" value={textOrNull(prospectiveClient, "medications_count")} onSave={save} />
          <AutoSaveField field="medication_list" label="Medication list" type="textarea" value={textOrNull(prospectiveClient, "medication_list")} onSave={save} />
        </FieldGrid>
      </Section>
      <Section id="requested-services" title="Requested Services" completed={completion(prospectiveClient, ["requested_services", "requested_hours_per_week", "requested_start_date", "preferred_schedule", "preferred_caregiver_gender", "preferred_caregiver_language", "caregiver_notes"])} total={7}>
        <AutoSaveCheckboxGroup field="requested_services" label="Services" value={prospectiveClient?.requested_services} options={requestedServices} onSave={save} />
        <FieldGrid>
          <AutoSaveField field="requested_hours_per_week" label="Requested hours/week" type="number" value={textOrNull(prospectiveClient, "requested_hours_per_week")} onSave={save} />
          <AutoSaveField field="requested_start_date" label="Requested start date" type="date" value={textOrNull(prospectiveClient, "requested_start_date")} onSave={save} />
          <AutoSaveField field="preferred_schedule" label="Preferred schedule" value={textOrNull(prospectiveClient, "preferred_schedule")} onSave={save} />
          <AutoSaveSelect field="preferred_caregiver_gender" label="Caregiver gender" value={textOrNull(prospectiveClient, "preferred_caregiver_gender")} options={[["female", "Female"], ["male", "Male"], ["no_preference", "No preference"]]} onSave={save} />
          <AutoSaveField field="preferred_caregiver_language" label="Caregiver language" value={textOrNull(prospectiveClient, "preferred_caregiver_language")} onSave={save} />
          <AutoSaveField field="caregiver_notes" label="Caregiver notes" type="textarea" value={textOrNull(prospectiveClient, "caregiver_notes")} onSave={save} />
        </FieldGrid>
      </Section>
      <Section id="existing-care" title="Existing Care" completed={completion(prospectiveClient, ["family_caregiver_available", "family_caregiver_relationship", "family_caregiver_wants_to_be_paid", "currently_receiving_services", "current_agency_name", "reason_for_change"])} total={6}>
        <FieldGrid>
          <AutoSaveCheckbox field="family_caregiver_available" label="Family caregiver available" value={boolOrNull(prospectiveClient, "family_caregiver_available")} onSave={save} />
          <AutoSaveField field="family_caregiver_relationship" label="Relationship" value={textOrNull(prospectiveClient, "family_caregiver_relationship")} onSave={save} />
          <AutoSaveCheckbox field="family_caregiver_wants_to_be_paid" label="Family caregiver wants to be paid" highlight value={boolOrNull(prospectiveClient, "family_caregiver_wants_to_be_paid")} onSave={save} />
          <AutoSaveCheckbox field="currently_receiving_services" label="Currently receiving services" value={boolOrNull(prospectiveClient, "currently_receiving_services")} onSave={save} />
          <AutoSaveField field="current_agency_name" label="Current agency" value={textOrNull(prospectiveClient, "current_agency_name")} onSave={save} />
          <AutoSaveField field="reason_for_change" label="Reason for change" type="textarea" value={textOrNull(prospectiveClient, "reason_for_change")} onSave={save} />
        </FieldGrid>
      </Section>
      <Button className="w-full" onClick={complete}>
        Mark Intake Complete
      </Button>
    </div>
  );
}

function CaregiverIntakeForm({
  lead,
  caregiverApplicant,
}: {
  lead: Lead;
  caregiverApplicant: DetailRecord | null;
}) {
  const form = useForm<Record<string, FieldValue>>({
    resolver: zodResolver(formValueSchema),
    defaultValues: Object.fromEntries(
      Object.entries(caregiverApplicant ?? {}).map(([key, value]) => [
        key,
        Array.isArray(value) ||
        typeof value === "string" ||
        typeof value === "number" ||
        typeof value === "boolean"
          ? value
          : null,
      ])
    ),
  });

  async function save(field: string, value: FieldValue) {
    form.setValue(field, value, { shouldValidate: true });
    return updateCaregiverApplicantField({ leadId: lead.id, field, value });
  }

  async function complete() {
    const parsed = caregiverCompletionSchema.safeParse(form.getValues());
    if (!parsed.success) {
      toast.error("Complete required caregiver fields first.");
      return;
    }
    const result = await markIntakeComplete({ leadId: lead.id });
    if (result.ok) {
      toast.success(result.message);
    } else {
      toast.error(result.message);
    }
  }

  return (
    <div className="grid gap-4">
      <Section id="caregiver-personal-info" title="Personal Info" defaultOpen completed={completion(caregiverApplicant, ["first_name", "last_name", "phone", "email", "date_of_birth", "status"])} total={6}>
        <FieldGrid>
          <AutoSaveField field="first_name" label="First name" required value={textOrNull(caregiverApplicant, "first_name")} onSave={save} />
          <AutoSaveField field="last_name" label="Last name" required value={textOrNull(caregiverApplicant, "last_name")} onSave={save} />
          <AutoSaveField field="phone" label="Phone" type="tel" required value={textOrNull(caregiverApplicant, "phone")} onSave={save} />
          <AutoSaveField field="email" label="Email" type="email" value={textOrNull(caregiverApplicant, "email")} onSave={save} />
          <AutoSaveField field="date_of_birth" label="DOB" type="date" value={textOrNull(caregiverApplicant, "date_of_birth")} onSave={save} />
        </FieldGrid>
      </Section>
      <Section id="caregiver-location" title="Location & Transportation" completed={completion(caregiverApplicant, ["address_city", "address_state", "address_zip", "has_drivers_license", "has_reliable_transportation", "willing_to_travel_miles"])} total={6}>
        <FieldGrid>
          <AutoSaveField field="address_city" label="City" value={textOrNull(caregiverApplicant, "address_city")} onSave={save} />
          <AutoSaveField field="address_state" label="State" value={textOrNull(caregiverApplicant, "address_state") || "MI"} onSave={save} />
          <AutoSaveField field="address_zip" label="ZIP" value={textOrNull(caregiverApplicant, "address_zip")} onSave={save} />
          <AutoSaveCheckbox field="has_drivers_license" label="Driver's license" value={boolOrNull(caregiverApplicant, "has_drivers_license")} onSave={save} />
          <AutoSaveCheckbox field="has_reliable_transportation" label="Reliable transportation" value={boolOrNull(caregiverApplicant, "has_reliable_transportation")} onSave={save} />
          <AutoSaveField field="willing_to_travel_miles" label="Travel miles" type="number" value={textOrNull(caregiverApplicant, "willing_to_travel_miles")} onSave={save} />
        </FieldGrid>
      </Section>
      <Section id="caregiver-experience" title="Experience & Certifications" completed={completion(caregiverApplicant, ["years_experience", "experience_types", "cna_certified", "hha_certified", "cpr_certified", "first_aid_certified", "languages_spoken"])} total={7}>
        <FieldGrid>
          <AutoSaveField field="years_experience" label="Years experience" type="number" value={textOrNull(caregiverApplicant, "years_experience")} onSave={save} />
          <AutoSaveCheckbox field="cna_certified" label="CNA certified" value={boolOrNull(caregiverApplicant, "cna_certified")} onSave={save} />
          <AutoSaveCheckbox field="hha_certified" label="HHA certified" value={boolOrNull(caregiverApplicant, "hha_certified")} onSave={save} />
          <AutoSaveCheckbox field="cpr_certified" label="CPR certified" value={boolOrNull(caregiverApplicant, "cpr_certified")} onSave={save} />
          <AutoSaveCheckbox field="first_aid_certified" label="First aid certified" value={boolOrNull(caregiverApplicant, "first_aid_certified")} onSave={save} />
        </FieldGrid>
        <AutoSaveCheckboxGroup field="experience_types" label="Experience types" value={caregiverApplicant?.experience_types} options={[["personal_care", "Personal care"], ["dementia", "Dementia"], ["hospice", "Hospice"], ["pediatric", "Pediatric"], ["behavioral", "Behavioral"], ["companion", "Companion"]]} onSave={save} />
      </Section>
      <Section id="caregiver-availability" title="Availability & CHAMPS" completed={completion(caregiverApplicant, ["hours_per_week_sought", "availability", "has_been_in_champs", "willing_to_enroll_in_champs", "referred_by", "relationship_to_prospective_client", "willing_background_check", "notes"])} total={8}>
        <FieldGrid>
          <AutoSaveField field="languages_spoken" label="Languages" value={Array.isArray(caregiverApplicant?.languages_spoken) ? caregiverApplicant.languages_spoken.join(", ") : ""} onSave={(field, value) => save(field, String(value).split(",").map((item) => item.trim()).filter(Boolean))} />
          <AutoSaveField field="hours_per_week_sought" label="Hours/week sought" type="number" value={textOrNull(caregiverApplicant, "hours_per_week_sought")} onSave={save} />
          <AutoSaveField field="availability" label="Availability" type="textarea" value={textOrNull(caregiverApplicant, "availability")} onSave={save} />
          <AutoSaveCheckbox field="has_been_in_champs" label="Has been in CHAMPS" value={boolOrNull(caregiverApplicant, "has_been_in_champs")} onSave={save} />
          <AutoSaveCheckbox field="willing_to_enroll_in_champs" label="Willing to enroll in CHAMPS" value={boolOrNull(caregiverApplicant, "willing_to_enroll_in_champs")} onSave={save} />
          <AutoSaveCheckbox field="willing_background_check" label="Background-check consent" value={boolOrNull(caregiverApplicant, "willing_background_check")} onSave={save} />
          <AutoSaveField field="referred_by" label="Referred by" value={textOrNull(caregiverApplicant, "referred_by")} onSave={save} />
          <AutoSaveField field="relationship_to_prospective_client" label="Relationship to prospective client" value={textOrNull(caregiverApplicant, "relationship_to_prospective_client")} onSave={save} />
          <AutoSaveSelect field="status" label="Application status" value={textOrNull(caregiverApplicant, "status") || "new"} options={caregiverStatuses.map((item) => [item, item.replaceAll("_", " ")])} onSave={save} />
          <AutoSaveField field="notes" label="Notes" type="textarea" value={textOrNull(caregiverApplicant, "notes")} onSave={save} />
        </FieldGrid>
      </Section>
      <div className="flex items-center justify-between rounded-xl border bg-background p-4">
        <Badge variant="outline">Autosave enabled</Badge>
        <Button onClick={complete}>Mark Intake Complete</Button>
      </div>
    </div>
  );
}
