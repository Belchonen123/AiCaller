import "server-only";

import { getRetellPhoneNumberAgentIds } from "@/lib/retell/connection-state";
import { getAgent, listAgents, listPhoneNumbers } from "@/lib/retell/client";
import { supabaseAdmin } from "@/lib/supabase/admin";

export type SetupStepState = "complete" | "incomplete" | "pending";

export type AgentWebhookStatus = {
  agent_id: string;
  agent_name: string;
  webhook_url: string | null;
  complete: boolean;
};

export type RetellSetupStatus = {
  apiKeyPresent: boolean;
  maskedApiKey: string | null;
  apiReachable: boolean;
  webhookSecretConfigured: boolean;
  webhookUrl: string;
  agents: Array<{
    agent_id: string;
    agent_name?: string | null;
    agentName?: string | null;
    name?: string | null;
    webhook_url?: string | null;
  }>;
  phoneNumbers: Array<{
    phone_number: string;
    nickname?: string;
    agent_id?: string;
    inbound_agent_id?: string;
    outbound_agent_id?: string;
    agent_ids?: string[];
    inbound_agent_ids?: string[];
    outbound_agent_ids?: string[];
  }>;
  linkedPairs: number;
  agentWebhookStatuses: AgentWebhookStatus[];
  lastCall: {
    id: string;
    created_at: string | null;
    duration_seconds: number | null;
    transcript: string | null;
    extraction: unknown | null;
  } | null;
  steps: {
    apiKey: SetupStepState;
    webhookSecret: SetupStepState;
    phoneNumber: SetupStepState;
    agent: SetupStepState;
    linkedPair: SetupStepState;
    webhookConfigured: SetupStepState;
    testCall: SetupStepState;
  };
  allComplete: boolean;
};

function maskApiKey(value: string | undefined) {
  if (!value) {
    return null;
  }

  return `••••${value.slice(-4)}`;
}

function agentName(agent: { agent_id: string; agent_name?: string | null; agentName?: string | null; name?: string | null }) {
  return agent.agent_name ?? agent.agentName ?? agent.name ?? agent.agent_id;
}

export async function loadRetellSetupStatus(params: {
  tenantId: string;
  appUrl: string;
}): Promise<RetellSetupStatus> {
  const apiKey = process.env.RETELL_API_KEY;
  const webhookSecret = process.env.RETELL_WEBHOOK_SECRET;
  const webhookUrl = `${params.appUrl.replace(/\/$/, "")}/api/retell/webhook`;
  const webhookHost = (() => {
    try {
      return new URL(webhookUrl).host;
    } catch {
      return "";
    }
  })();

  const [agentsResult, phoneNumbersResult, lastCallResult] = await Promise.allSettled([
    listAgents(),
    listPhoneNumbers(),
    supabaseAdmin
      .from("intake_calls")
      .select("id, created_at, duration_seconds, transcript, extraction")
      .eq("tenant_id", params.tenantId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle<{
        id: string;
        created_at: string | null;
        duration_seconds: number | null;
        transcript: string | null;
        extraction: unknown | null;
      }>(),
  ]);

  const agents = agentsResult.status === "fulfilled" ? agentsResult.value : [];
  const phoneNumbers =
    phoneNumbersResult.status === "fulfilled" ? phoneNumbersResult.value : [];
  const apiReachable = agentsResult.status === "fulfilled" && phoneNumbersResult.status === "fulfilled";
  const agentIds = new Set(agents.map((agent) => agent.agent_id));
  const linkedPairs = phoneNumbers.filter((phoneNumber) =>
    getRetellPhoneNumberAgentIds(phoneNumber).some((agentId) => agentIds.has(agentId))
  ).length;
  const agentsToCheck = agents.slice(0, 5);
  const agentDetailResults = await Promise.allSettled(
    agentsToCheck.map(async (agent) => {
      if (agent.webhook_url) {
        return agent;
      }

      return getAgent(agent.agent_id);
    })
  );
  const agentWebhookStatuses = agentsToCheck.map((agent, index) => {
    const detail =
      agentDetailResults[index]?.status === "fulfilled"
        ? agentDetailResults[index].value
        : agent;
    const webhook_url = typeof detail.webhook_url === "string" ? detail.webhook_url : null;

    return {
      agent_id: agent.agent_id,
      agent_name: agentName(agent),
      webhook_url,
      complete: Boolean(webhookHost && webhook_url?.includes(webhookHost)),
    };
  });
  const lastCall =
    lastCallResult.status === "fulfilled" && lastCallResult.value.data
      ? lastCallResult.value.data
      : null;
  const steps = {
    apiKey: apiKey ? "complete" : "incomplete",
    webhookSecret:
      webhookSecret && webhookSecret.length >= 16 ? "complete" : "incomplete",
    phoneNumber: phoneNumbers.length > 0 ? "complete" : "incomplete",
    agent: agents.length > 0 ? "complete" : "incomplete",
    linkedPair: linkedPairs > 0 ? "complete" : "incomplete",
    webhookConfigured:
      agents.length > 0 &&
      agentWebhookStatuses.length > 0 &&
      agentWebhookStatuses.every((agent) => agent.complete)
        ? "complete"
        : "incomplete",
    testCall: lastCall ? "complete" : "incomplete",
  } satisfies RetellSetupStatus["steps"];
  const allComplete = Object.values(steps).every((step) => step === "complete");

  return {
    apiKeyPresent: Boolean(apiKey),
    maskedApiKey: maskApiKey(apiKey),
    apiReachable,
    webhookSecretConfigured: steps.webhookSecret === "complete",
    webhookUrl,
    agents,
    phoneNumbers,
    linkedPairs,
    agentWebhookStatuses,
    lastCall,
    steps,
    allComplete,
  };
}
