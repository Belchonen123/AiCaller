export const leadStatuses = [
  "new",
  "contacted",
  "info_gathering",
  "pending_eligibility",
  "scheduled_assessment",
  "assessment_complete",
  "pending_auth",
  "authorized",
  "enrolled",
  "disqualified",
  "lost",
  "on_hold",
] as const;

export const statusLabels: Record<(typeof leadStatuses)[number], string> = {
  new: "New",
  contacted: "Contacted",
  info_gathering: "Info Gathering",
  pending_eligibility: "Pending Eligibility",
  scheduled_assessment: "Scheduled Assessment",
  assessment_complete: "Assessment Complete",
  pending_auth: "Pending Auth",
  authorized: "Authorized",
  enrolled: "Enrolled",
  disqualified: "Disqualified",
  lost: "Lost",
  on_hold: "On Hold",
};

export const statusTransitions: Record<
  (typeof leadStatuses)[number],
  (typeof leadStatuses)[number][]
> = {
  new: ["contacted", "info_gathering", "disqualified"],
  contacted: ["info_gathering", "scheduled_assessment", "lost", "on_hold"],
  info_gathering: ["pending_eligibility", "scheduled_assessment", "disqualified"],
  pending_eligibility: ["scheduled_assessment", "pending_auth", "disqualified"],
  scheduled_assessment: ["assessment_complete", "on_hold"],
  assessment_complete: ["pending_auth", "authorized", "disqualified"],
  pending_auth: ["authorized", "on_hold", "disqualified"],
  authorized: ["enrolled", "on_hold"],
  enrolled: ["on_hold", "lost"],
  disqualified: ["new"],
  lost: ["new"],
  on_hold: ["contacted", "info_gathering", "lost"],
};

export const leadTypes = [
  "client_referral",
  "caregiver_applicant",
  "existing_client",
  "other",
] as const;

export const urgencyOptions = [
  "emergent",
  "urgent",
  "routine",
  "informational",
] as const;

export const clientRequiredFields = [
  "first_name",
  "last_name",
  "date_of_birth",
  "address_street",
  "address_city",
  "address_zip",
  "primary_payer",
] as const;

export const adlFields = [
  ["adl_bathing", "Bathing"],
  ["adl_dressing", "Dressing"],
  ["adl_grooming", "Grooming"],
  ["adl_toileting", "Toileting"],
  ["adl_transferring", "Transferring"],
  ["adl_eating", "Eating/Feeding"],
] as const;

export const iadlFields = [
  ["iadl_meal_prep", "Meal prep"],
  ["iadl_light_housework", "Light housework"],
  ["iadl_laundry", "Laundry"],
  ["iadl_shopping", "Shopping"],
  ["iadl_medication_reminders", "Medication reminders"],
  ["iadl_transportation", "Transportation"],
] as const;

export const adlLevels = [
  ["independent", "Independent"],
  ["supervision", "Supervision"],
  ["partial_assist", "Partial"],
  ["total_assist", "Total"],
  ["unknown", "Unknown"],
] as const;

export const iadlLevels = [
  ["independent", "Independent"],
  ["needs_help", "Needs help"],
  ["total_assist", "Total"],
  ["unknown", "Unknown"],
] as const;

export const requestedServices = [
  ["personal_care", "Personal care"],
  ["meal_prep", "Meal prep"],
  ["light_housework", "Light housework"],
  ["laundry", "Laundry"],
  ["shopping", "Shopping"],
  ["medication_reminders", "Medication reminders"],
  ["transportation", "Transportation"],
  ["companionship", "Companionship"],
  ["respite_care", "Respite care"],
  ["other", "Other"],
] as const;

export const primaryPayers = [
  ["medicaid_home_help", "MDHHS Home Help"],
  ["mi_choice_waiver", "MI Choice Waiver"],
  ["mco_meridian", "Meridian"],
  ["mco_molina", "Molina"],
  ["mco_hap", "HAP"],
  ["mco_aetna_better_health", "Aetna Better Health"],
  ["mco_priority_health", "Priority Health"],
  ["mco_united_community", "UnitedHealthcare Community Plan"],
  ["mco_bcbs_complete", "Blue Cross Complete"],
  ["mco_other", "Other MCO"],
  ["medicare", "Medicare"],
  ["medicare_advantage", "Medicare Advantage"],
  ["private_pay", "Private pay"],
  ["ltc_insurance", "Long-term care insurance"],
  ["va", "VA"],
  ["dual_eligible", "Dual eligible"],
  ["self_pay_pending_medicaid", "Self-pay pending Medicaid"],
  ["unknown", "Unknown"],
  ["not_discussed", "Not discussed"],
] as const;

export const caregiverStatuses = [
  "new",
  "phone_screened",
  "interview_scheduled",
  "interview_complete",
  "background_pending",
  "cleared",
  "hired",
  "rejected",
  "withdrew",
] as const;
