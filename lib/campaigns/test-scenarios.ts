export const testCallScenarios = [
  {
    id: "adult-child-mom",
    label: "New client referral — adult child calling about mom",
    merge_fields: {
      mode: "test_outbound",
      scenario_type: "new_client_referral",
      scenario_description: "an adult child calling about getting help at home for mom",
      caller_role: "adult child",
      caller_goal: "Ask about help for an older parent who needs support with bathing, meals, and safety.",
      likely_path: "client_referral",
    },
  },
  {
    id: "mco-case-manager",
    label: "New client referral — case manager from MCO",
    merge_fields: {
      mode: "test_outbound",
      scenario_type: "new_client_referral",
      scenario_description: "a case manager from a Medicaid health plan referring a member",
      caller_role: "MCO case manager",
      caller_goal: "Refer a member who may need home help services and follow-up from intake.",
      likely_path: "client_referral",
    },
  },
  {
    id: "experienced-hha",
    label: "Caregiver applicant — experienced HHA looking for work",
    merge_fields: {
      mode: "test_outbound",
      scenario_type: "caregiver_applicant",
      scenario_description: "an experienced HHA looking for caregiving work",
      caller_role: "caregiver applicant",
      caller_goal: "Apply for work and describe experience, certifications, availability, and travel distance.",
      likely_path: "caregiver_applicant",
    },
  },
  {
    id: "family-paid-caregiver",
    label: "Caregiver applicant — family member wanting to be paid",
    merge_fields: {
      mode: "test_outbound",
      scenario_type: "caregiver_applicant",
      scenario_description: "a family member asking how to get paid to care for a relative",
      caller_role: "family caregiver applicant",
      caller_goal: "Ask about becoming a paid caregiver for a relative through Medicaid Home Help.",
      likely_path: "caregiver_applicant",
    },
  },
  {
    id: "existing-client-status",
    label: "Existing client question — status update",
    merge_fields: {
      mode: "test_outbound",
      scenario_type: "existing_client",
      scenario_description: "an existing client calling for a status update",
      caller_role: "existing client or family contact",
      caller_goal: "Ask for a status update about services, scheduling, authorization, or callback timing.",
      likely_path: "existing_client",
    },
  },
  {
    id: "fall-red-flag",
    label: "Emergency/red flag test — caller describes fall",
    merge_fields: {
      mode: "test_outbound",
      scenario_type: "red_flag",
      scenario_description: "a worried caller describing a recent fall and possible safety concern",
      caller_role: "worried family member",
      caller_goal: "Mention a fall and safety concerns so the intake agent can detect urgency and red flags.",
      likely_path: "client_referral",
    },
  },
  {
    id: "confused-misdial",
    label: "Confused caller — misdialed",
    merge_fields: {
      mode: "test_outbound",
      scenario_type: "wrong_number",
      scenario_description: "a confused caller who may have dialed the wrong number",
      caller_role: "confused caller",
      caller_goal: "Sound unsure and possibly misdialed so the agent can gracefully classify other or wrong number.",
      likely_path: "other",
    },
  },
  {
    id: "custom",
    label: "Custom (no preset)",
    merge_fields: {
      mode: "test_outbound",
      scenario_type: "custom",
      scenario_description: "a custom test caller scenario",
    },
  },
] as const;

export type TestCallScenarioId = (typeof testCallScenarios)[number]["id"];

export function getTestCallScenario(id: string) {
  return testCallScenarios.find((scenario) => scenario.id === id) ?? testCallScenarios[0];
}
