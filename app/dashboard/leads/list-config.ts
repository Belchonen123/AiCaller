export const defaultActiveStatuses = [
  "new",
  "contacted",
  "info_gathering",
  "pending_eligibility",
  "scheduled_assessment",
  "assessment_complete",
  "pending_auth",
  "authorized",
  "on_hold",
] as const;

export const leadTypeOptions = [
  ["client_referral", "Client referral"],
  ["caregiver_applicant", "Caregiver applicant"],
  ["existing_client", "Existing client"],
  ["other", "Other"],
] as const;

export const leadStatusOptions = [
  ["new", "New"],
  ["contacted", "Contacted"],
  ["info_gathering", "Info gathering"],
  ["pending_eligibility", "Pending eligibility"],
  ["scheduled_assessment", "Scheduled assessment"],
  ["assessment_complete", "Assessment complete"],
  ["pending_auth", "Pending auth"],
  ["authorized", "Authorized"],
  ["enrolled", "Enrolled"],
  ["disqualified", "Disqualified"],
  ["lost", "Lost"],
  ["on_hold", "On hold"],
] as const;

export const urgencyOptions = [
  ["emergent", "Emergent"],
  ["urgent", "Urgent"],
  ["routine", "Routine"],
  ["informational", "Informational"],
] as const;

export const payerOptions = [
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
  ["ltc_insurance", "LTC insurance"],
  ["va", "VA"],
  ["dual_eligible", "Dual eligible"],
  ["self_pay_pending_medicaid", "Self-pay pending Medicaid"],
  ["unknown", "Unknown"],
  ["not_discussed", "Not discussed"],
] as const;

export const payerLabels = Object.fromEntries(payerOptions);
export const statusLabels = Object.fromEntries(leadStatusOptions);
export const leadTypeLabels = Object.fromEntries(leadTypeOptions);
