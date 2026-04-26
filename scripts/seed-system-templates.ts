import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createClient } from "@supabase/supabase-js";
import type { SupabaseClient } from "@supabase/supabase-js";

type TemplatePurpose =
  | "client_intake"
  | "caregiver_recruitment"
  | "reengagement"
  | "eligibility_followup"
  | "appointment_reminder"
  | "satisfaction_survey"
  | "general"
  | "test";

type TemplateCategory = "inbound" | "outbound" | "test" | "specialty";

type RetellPayload = {
  agent_name: string;
  voice_id: string;
  language?: string;
  response_engine: {
    type: "retell-llm" | "conversation-flow" | "single-prompt";
    llm_id?: string;
    conversation_flow_id?: string;
    prompt?: string;
  };
  webhook_url?: string;
  interruption_sensitivity?: number;
  enable_backchannel?: boolean;
  backchannel_frequency?: number;
  responsiveness?: number;
  voice_speed?: number;
  voice_temperature?: number;
  ambient_sound?: string | null;
  post_call_analysis_data?: Array<unknown>;
  post_call_analysis_model?: string;
  allow_user_dtmf?: boolean;
  voicemail_option?: { action?: { type: string; text?: string } };
  normalize_for_speech?: boolean;
  end_call_after_silence_ms?: number;
  max_call_duration_ms?: number;
  begin_message_delay_ms?: number;
  enable_transcription_formatting?: boolean;
  retell_llm?: {
    general_prompt: string;
    general_tools?: Array<unknown>;
    states?: Array<unknown>;
    starting_state?: string;
    begin_message?: string;
    model?: string;
    model_temperature?: number;
    model_high_priority?: boolean;
    tool_call_strict_mode?: boolean;
    default_dynamic_variables?: Record<string, string>;
    knowledge_base_ids?: string[];
  };
};

type SystemTemplate = {
  name: string;
  slug: string;
  description: string;
  category: TemplateCategory;
  purpose: TemplatePurpose;
  tags: string[];
  version: number;
  retell_payload: RetellPayload;
  default_voice: string;
  default_llm_model: string;
  required_variables: string[];
  default_variables: Record<string, string>;
};

function loadLocalEnv() {
  try {
    const envFile = readFileSync(resolve(process.cwd(), ".env.local"), "utf8");

    for (const line of envFile.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) {
        continue;
      }

      const separatorIndex = trimmed.indexOf("=");
      if (separatorIndex === -1) {
        continue;
      }

      const key = trimmed.slice(0, separatorIndex).trim();
      const value = trimmed
        .slice(separatorIndex + 1)
        .trim()
        .replace(/^['"]|['"]$/g, "");

      process.env[key] ??= value;
    }
  } catch {
    // Environment variables may already be provided by the shell.
  }
}

function refuseProduction() {
  if (process.env.NODE_ENV === "production" || process.env.VERCEL_ENV === "production") {
    throw new Error("Refusing to seed system templates in production.");
  }
}

function getRequiredEnv(name: string) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} is required`);
  }

  return value;
}

function loadInboundPrompt() {
  const doc = readFileSync(resolve(process.cwd(), "docs/retell-agent-config.md"), "utf8");
  const match = doc.match(/## Agent System Prompt\s+```text\s+([\s\S]*?)```/);
  if (!match?.[1]) {
    throw new Error("Unable to read inbound system prompt from docs/retell-agent-config.md");
  }

  return match[1].trim().replace("[X business hours]", "{{agency_callback_hours}}");
}

const lookupCallerTool = {
  type: "function",
  name: "lookup_caller",
  description:
    "Looks up whether the caller's phone number is associated with recent intake history. Call this once at the start of every inbound call before asking intake questions.",
  url: "{{webhook_base_url}}/api/retell/tools/lookup-caller",
  method: "POST",
  args_schema: {
    type: "object",
    properties: {
      phone_number: {
        type: "string",
        description: "The caller's phone number from the inbound call.",
      },
    },
    required: ["phone_number"],
  },
};

const intakeAnalysisFields = [
  {
    name: "summary",
    type: "string",
    description: "A concise plain-English summary of why the person called and what should happen next.",
  },
  {
    name: "lead_type",
    type: "string",
    description:
      "One of client_referral, caregiver_applicant, existing_client, or other based on the caller's main reason for calling.",
  },
  {
    name: "urgency",
    type: "string",
    description: "One of emergent, urgent, routine, informational, or unknown.",
  },
  {
    name: "contact",
    type: "object",
    description:
      "Caller/contact details including full_name, phone, phone_alt, email, relationship_to_client, preferred_contact_method, best_time_to_reach, notes.",
  },
  {
    name: "prospective_client",
    type: "object",
    description:
      "Client referral details including name, city, county, payer, diagnoses, ADL needs, living situation, and requested start timing.",
  },
  {
    name: "caregiver_applicant",
    type: "object",
    description:
      "Caregiver applicant details including name, city, experience, certifications, languages, availability, transportation, and CHAMPS readiness.",
  },
  {
    name: "red_flags",
    type: "array",
    description:
      "Safety, abuse, neglect, emergency, medication, fall, caregiver burnout, or urgent staffing concerns mentioned in the call.",
  },
  {
    name: "next_steps",
    type: "string",
    description: "The follow-up action the agency team should take.",
  },
];

function singlePromptPayload(params: {
  agentName: string;
  voiceId?: string;
  beginMessage: string;
  prompt: string;
  tools?: Array<unknown>;
  voicemailText?: string;
  postCallAnalysis?: boolean;
}): RetellPayload {
  return {
    agent_name: params.agentName,
    voice_id: params.voiceId ?? "11labs-Rachel",
    language: "en-US",
    response_engine: {
      type: "retell-llm",
    },
    webhook_url: "{{webhook_base_url}}/api/retell/webhook",
    interruption_sensitivity: 0.4,
    enable_backchannel: true,
    backchannel_frequency: 0.7,
    responsiveness: 0.55,
    voice_speed: 0.95,
    voice_temperature: 0.7,
    ambient_sound: null,
    post_call_analysis_model: params.postCallAnalysis === false ? undefined : "gpt-4o",
    post_call_analysis_data: params.postCallAnalysis === false ? undefined : intakeAnalysisFields,
    allow_user_dtmf: true,
    voicemail_option: params.voicemailText
      ? {
          action: {
            type: "static_text",
            text: params.voicemailText,
          },
        }
      : undefined,
    normalize_for_speech: true,
    end_call_after_silence_ms: 12_000,
    max_call_duration_ms: 900_000,
    begin_message_delay_ms: 500,
    enable_transcription_formatting: true,
    retell_llm: {
      general_prompt: params.prompt,
      general_tools: params.tools,
      begin_message: params.beginMessage,
      model: "claude-sonnet-4-6",
      model_temperature: 0.25,
      model_high_priority: true,
      tool_call_strict_mode: true,
      default_dynamic_variables: {},
    },
  };
}

function caregiverRecruitmentPrompt() {
  return `You are an outbound caregiver recruitment callback assistant for {{agency_name}}, a Michigan homecare agency.

You are calling someone who inquired about a caregiver position. Your job is to confirm interest, gather basic hiring-screen information, and route the details to a human hiring contact. Be warm, professional, brief, and respectful. Ask one question at a time.

Opening:
"Hi, is this {{applicant_name}}? This is {{agency_name}} calling about the caregiver position you inquired about."

If this is not {{applicant_name}}, apologize and end politely without sharing details.

If {{applicant_name}} is available, explain:
"I just need to ask a few quick questions so our hiring team can follow up with the right next step."

Gather:
1. Current city and how far they are willing to travel for work.
2. General availability: days, evenings, weekends, overnight, live-in, and approximate hours desired.
3. Years of caregiving experience and types of care provided.
4. Certifications: CNA, HHA, CPR, First Aid, or other training.
5. Reliable transportation and whether they can get to client homes consistently.
6. Whether they are willing to enroll in CHAMPS if needed for Michigan Medicaid Home Help work.
7. Whether they are comfortable with background checks and onboarding paperwork.
8. Best callback time and preferred contact method.

If the applicant asks about pay, schedules, benefits, or exact job placement, do not guess and do not quote a rate. Say:
"I'll have {{hiring_contact}} share specifics when they follow up {{agency_callback_hours}}."

Hard rules:
- Do not promise employment.
- Do not promise a pay rate, case assignment, schedule, or start date.
- Do not collect Social Security numbers, bank information, driver's license numbers, or date of birth.
- If they ask to speak with a human, say a hiring team member will call them back.
- If they are no longer interested, thank them and mark that clearly.

Close:
"Thanks, {{applicant_name}}. I will send this to {{agency_name}}'s hiring team, and someone will follow up {{agency_callback_hours}}."`;
}

function referralFollowupPrompt() {
  return `You are an outbound referral-source follow-up assistant for {{agency_name}}, a Michigan homecare agency.

You are calling {{referral_partner_name}}, such as a case manager, discharge planner, social worker, or referral coordinator, about a referral involving {{lead_client_name}} from {{days_since_referral}} days ago.

Purpose:
- Confirm the referral was received.
- Provide a brief care-coordination status update in general terms.
- Ask whether the referral source has any new information that would help the agency follow up appropriately.

Privacy and PHI rules:
- Share only the minimum necessary information for care coordination.
- Do not disclose diagnoses, Medicaid IDs, full addresses, detailed family conflict, financial details, or sensitive notes unless the referral source clearly already provided them and asks for confirmation.
- Do not discuss unrelated clients or agency operations.
- If the person you reach is not connected to the referral, do not share details. Ask for the correct contact or end the call.

Opening:
"Hi, this is {{agency_name}} following up with {{referral_partner_name}} about a referral for {{lead_client_name}} from about {{days_since_referral}} days ago. Is this a good person to speak with about that referral?"

If yes, say:
"I'm calling to confirm we received the referral and to check whether there is any updated information we should know before our next outreach."

Keep status language general:
- "Our team has the referral and is following up."
- "We are still trying to connect with the family."
- "We are gathering intake information."
- "We are waiting on the next eligibility or scheduling step."

Ask:
1. "Is there any new contact information or preferred callback time?"
2. "Has anything changed with urgency, discharge timing, safety, or caregiver availability?"
3. "Is there another person we should coordinate with?"

Hard rules:
- Do not promise admission, eligibility, authorization, hours, or start date.
- Do not provide legal, medical, or Medicaid advice.
- Do not leave detailed PHI on voicemail.

Close:
"Thank you. I will pass that to {{agency_name}}'s intake team so they can keep the referral moving."`;
}

function eligibilityFollowupPrompt() {
  return `You are an outbound eligibility-status follow-up assistant for {{agency_name}}, a Michigan Home Help agency.

You are calling {{client_first_name}} or their representative to ask whether their MDHHS or MCO eligibility determination has come through. The case was opened or discussed around {{medicaid_case_opened_at}}. The next action on file is: {{next_action}}.

Your job is to gather a simple status update and help the agency know whether to proceed with scheduling, keep waiting, or follow up again later.

Opening:
"Hi, may I speak with {{client_first_name}} or the person helping with their Home Help paperwork? This is {{agency_name}} calling to check whether there has been any update from MDHHS or your health plan."

Ask one question at a time:
1. "Have you received any letter, phone call, portal message, or notice about the eligibility or authorization?"
2. "Do you know whether it was approved, denied, still pending, or if more information was requested?"
3. "Did they give you a caseworker name, plan contact, or next appointment date?"
4. "Is there anything the agency team should know before they call you back?"

If approved or ready:
"Thank you. I will let the team know we can proceed with scheduling an assessment."

If still pending or unknown:
"Thank you. I will mark this as still pending, and we'll try again in {{retry_days}} days."

If denied, delayed, or confusing:
"Thank you for explaining. I will have the team review this and call you back. They can talk through what information they need, but I cannot give legal or eligibility advice."

Hard rules:
- Do not promise eligibility.
- Do not interpret legal notices.
- Do not tell the caller they qualify or do not qualify.
- Do not advise them to appeal, choose a plan, or make Medicaid decisions.
- Do not collect full Social Security numbers or Medicaid IDs.
- If they ask for a human, say the team will call back.

Close:
"Thanks. I will send this update to {{agency_name}} so they can take the next step."`;
}

function testRoleplayPrompt() {
  return `You are an AI role-play caller used for testing a homecare intake team.

The human on the phone is the intake staff member. You play the caller described by this scenario:
{{scenario_description}}

Opening:
"Hi — this is a test call. I'll be playing the role of {{scenario_description}}. You're the intake person. Go ahead whenever you're ready."

Role-play rules:
- Stay in character as the caller.
- Answer the human's questions naturally based on the scenario.
- Do not volunteer every detail at once. Let the human guide the intake.
- If the human asks clarifying questions, provide realistic answers that fit the scenario.
- If the scenario includes distress, confusion, urgency, caregiver burnout, wrong-number behavior, or reluctance, portray it realistically but safely.
- Do not claim this is a real emergency or real patient unless it is clearly part of the simulation.
- If asked directly whether this is a test, say yes, this is a test role-play call.
- Keep the call useful for evaluating intake skills, empathy, safety screening, and next-step clarity.

End the role-play when the human clearly closes the call or asks to stop the test.`;
}

function buildTemplates(): SystemTemplate[] {
  const inboundPrompt = loadInboundPrompt();

  return [
    {
      name: "Michigan Home Help — Inbound Intake",
      slug: "homecare-inbound-intake-mi",
      description: "Inbound Michigan Medicaid Home Help intake assistant for first calls and basic routing.",
      category: "inbound",
      purpose: "client_intake",
      tags: ["inbound", "michigan", "home_help", "intake"],
      version: 1,
      default_voice: "11labs-Rachel",
      default_llm_model: "claude-sonnet-4-6",
      required_variables: ["agency_name", "agency_callback_hours"],
      default_variables: {
        agency_name: "our agency",
        agency_callback_hours: "within 2 business hours",
      },
      retell_payload: singlePromptPayload({
        agentName: "Michigan Home Help — Inbound Intake",
        beginMessage:
          "Hi, thanks for calling {{agency_name}}. This is Rachel — how can I help you today?",
        prompt: inboundPrompt,
        tools: [lookupCallerTool],
      }),
    },
    {
      name: "Michigan Homecare — Caregiver Recruitment Callback",
      slug: "homecare-caregiver-recruitment-outbound-mi",
      description: "Outbound callback assistant for Michigan homecare caregiver applicants.",
      category: "outbound",
      purpose: "caregiver_recruitment",
      tags: ["outbound", "michigan", "recruitment", "hha", "cna"],
      version: 1,
      default_voice: "11labs-Rachel",
      default_llm_model: "claude-sonnet-4-6",
      required_variables: [
        "agency_name",
        "applicant_name",
        "agency_callback_hours",
        "hiring_contact",
      ],
      default_variables: {
        agency_name: "our agency",
        applicant_name: "the applicant",
        agency_callback_hours: "within 2 business days",
        hiring_contact: "our hiring coordinator",
      },
      retell_payload: singlePromptPayload({
        agentName: "Michigan Homecare — Caregiver Recruitment Callback",
        beginMessage:
          "Hi, is this {{applicant_name}}? This is {{agency_name}} calling about the caregiver position you inquired about.",
        prompt: caregiverRecruitmentPrompt(),
        voicemailText:
          "Hi {{applicant_name}}, this is {{agency_name}} calling about the caregiver position you inquired about. Please call us back at the number you used when you have a moment. Thank you.",
      }),
    },
    {
      name: "Michigan Homecare — Referral Source Follow-Up",
      slug: "homecare-referral-followup-outbound-mi",
      description: "Outbound referral-source status follow-up for case managers and social workers.",
      category: "outbound",
      purpose: "reengagement",
      tags: ["outbound", "michigan", "referral_partner", "followup"],
      version: 1,
      default_voice: "11labs-Rachel",
      default_llm_model: "claude-sonnet-4-6",
      required_variables: [
        "agency_name",
        "lead_client_name",
        "referral_partner_name",
        "days_since_referral",
      ],
      default_variables: {
        agency_name: "our agency",
        lead_client_name: "the client",
        referral_partner_name: "the referral partner",
        days_since_referral: "a few",
      },
      retell_payload: singlePromptPayload({
        agentName: "Michigan Homecare — Referral Source Follow-Up",
        beginMessage:
          "Hi, this is {{agency_name}} following up with {{referral_partner_name}} about a referral for {{lead_client_name}}.",
        prompt: referralFollowupPrompt(),
        voicemailText:
          "Hi, this is {{agency_name}} following up on a referral. Please call us back at the number you used when convenient. Thank you.",
      }),
    },
    {
      name: "Michigan Home Help — Eligibility Status Follow-Up",
      slug: "homecare-eligibility-check-outbound-mi",
      description: "Outbound follow-up assistant for Michigan Home Help eligibility and authorization status.",
      category: "outbound",
      purpose: "eligibility_followup",
      tags: ["outbound", "michigan", "medicaid", "eligibility"],
      version: 1,
      default_voice: "11labs-Rachel",
      default_llm_model: "claude-sonnet-4-6",
      required_variables: [
        "agency_name",
        "client_first_name",
        "medicaid_case_opened_at",
        "next_action",
      ],
      default_variables: {
        agency_name: "our agency",
        client_first_name: "the client",
        medicaid_case_opened_at: "recently",
        next_action: "check eligibility status",
        retry_days: "7",
      },
      retell_payload: singlePromptPayload({
        agentName: "Michigan Home Help — Eligibility Status Follow-Up",
        beginMessage:
          "Hi, may I speak with {{client_first_name}} or the person helping with their Home Help paperwork? This is {{agency_name}} calling to check for an eligibility update.",
        prompt: eligibilityFollowupPrompt(),
        voicemailText:
          "Hi, this is {{agency_name}} calling to check for an eligibility update. Please call us back at the number you used when you have a moment. Thank you.",
      }),
    },
    {
      name: "AI Test — Role-play Any Scenario",
      slug: "homecare-test-roleplay-bidirectional",
      description: "Test-call template where the agent role-plays a caller for intake staff practice.",
      category: "test",
      purpose: "test",
      tags: ["test", "demo", "roleplay"],
      version: 1,
      default_voice: "11labs-Rachel",
      default_llm_model: "claude-sonnet-4-6",
      required_variables: ["scenario_description"],
      default_variables: {
        scenario_description: "a caller asking about homecare services",
      },
      retell_payload: singlePromptPayload({
        agentName: "AI Test — Role-play Any Scenario",
        beginMessage:
          "Hi — this is a test call. I'll be playing the role of {{scenario_description}}. You're the intake person. Go ahead whenever you're ready.",
        prompt: testRoleplayPrompt(),
        postCallAnalysis: false,
      }),
    },
  ];
}

async function seedTemplate(
  supabase: SupabaseClient,
  template: SystemTemplate
) {
  const { data: existing, error: selectError } = await supabase
    .from("agent_templates")
    .select("id")
    .eq("slug", template.slug)
    .eq("is_system", true)
    .maybeSingle<{ id: string }>();

  if (selectError) {
    throw new Error(`Failed to check existing template ${template.slug}: ${selectError.message}`);
  }

  const row = {
    tenant_id: null,
    name: template.name,
    slug: template.slug,
    description: template.description,
    category: template.category,
    purpose: template.purpose,
    tags: template.tags,
    version: template.version,
    retell_payload: template.retell_payload,
    default_voice: template.default_voice,
    default_llm_model: template.default_llm_model,
    required_variables: template.required_variables,
    default_variables: template.default_variables,
    is_system: true,
  };

  if (existing) {
    const { error } = await supabase
      .from("agent_templates")
      .update(row)
      .eq("id", existing.id);

    if (error) {
      throw new Error(`Failed to update template ${template.slug}: ${error.message}`);
    }

    return;
  }

  const { error } = await supabase.from("agent_templates").insert(row);

  if (error) {
    throw new Error(`Failed to insert template ${template.slug}: ${error.message}`);
  }
}

async function main() {
  loadLocalEnv();
  refuseProduction();

  const supabase = createClient(
    getRequiredEnv("NEXT_PUBLIC_SUPABASE_URL"),
    getRequiredEnv("SUPABASE_SERVICE_ROLE_KEY"),
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }
  );
  const templates = buildTemplates();

  for (const template of templates) {
    await seedTemplate(supabase, template);
  }

  console.log(`Seeded/updated ${templates.length} system agent templates.`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
