import "server-only";

type TenantSettings = {
  name: string;
  agency_phone: string | null;
  agency_address: string | null;
};

const callPurposeByCampaignPurpose: Record<string, string> = {
  caregiver_recruitment: "caregiver_recruitment_followup",
  referral_followup: "referral_status_update",
  eligibility_check: "eligibility_check",
  followup: "general_outreach",
  reengagement: "general_outreach",
  general_outreach: "general_outreach",
  test: "general_outreach",
};

export function buildSettingsDynamicVariables(params: {
  tenant: TenantSettings;
  campaignPurpose?: string | null;
  now?: Date;
}): Record<string, string> {
  const variables: Record<string, string> = {
    agency_name: params.tenant.name,
    current_time: (params.now ?? new Date()).toISOString(),
  };

  if (params.tenant.agency_phone) {
    variables.agency_callback_number = params.tenant.agency_phone;
    variables.agency_phone = params.tenant.agency_phone;
  }

  if (params.tenant.agency_address) {
    variables.agency_address = params.tenant.agency_address;
  }

  const callPurpose = params.campaignPurpose
    ? callPurposeByCampaignPurpose[params.campaignPurpose]
    : undefined;
  if (callPurpose) {
    variables.call_purpose = callPurpose;
  }

  return variables;
}

export function mergeRetellDynamicVariables(
  ...sources: Array<Record<string, unknown> | null | undefined>
): Record<string, string> {
  const merged = Object.assign({}, ...sources);

  return Object.fromEntries(
    Object.entries(merged)
      .filter(([, value]) => value !== null && value !== undefined)
      .map(([key, value]) => [
        key,
        typeof value === "object" ? JSON.stringify(value) : String(value),
      ])
  );
}
