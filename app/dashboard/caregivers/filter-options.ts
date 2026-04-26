export const caregiverStatuses = [
  "all",
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

export const certificationOptions = [
  ["cna_certified", "CNA"],
  ["hha_certified", "HHA"],
  ["cpr_certified", "CPR"],
  ["first_aid_certified", "FA"],
] as const;

export const experienceRanges = [
  ["all", "Any experience"],
  ["0-1", "0-1 years"],
  ["1-3", "1-3 years"],
  ["3-5", "3-5 years"],
  ["5+", "5+ years"],
] as const;
