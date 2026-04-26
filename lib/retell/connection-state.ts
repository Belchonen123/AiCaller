export type RetellConnectionState =
  | "ok"
  | "no_api_key"
  | "no_agents"
  | "no_phone_numbers"
  | "no_linked_pair";

export type RetellConnectionAgent = {
  agent_id: string;
  agent_name?: string | null;
  agentName?: string | null;
  name?: string | null;
};

export type RetellConnectionPhoneNumber = {
  phone_number: string;
  nickname?: string;
  agent_id?: string;
  inbound_agent_id?: string;
  outbound_agent_id?: string;
  agent_ids?: string[];
  inbound_agent_ids?: string[];
  outbound_agent_ids?: string[];
};

export type RetellConnectionStatus = {
  connectionState: RetellConnectionState;
  issues: string[];
};

export function getRetellConnectionStatus(params: {
  agents: RetellConnectionAgent[];
  phoneNumbers: RetellConnectionPhoneNumber[];
  agentsLoadFailed: boolean;
  phoneNumbersLoadFailed: boolean;
}): RetellConnectionStatus {
  if (params.agentsLoadFailed || params.phoneNumbersLoadFailed) {
    return {
      connectionState: "no_api_key",
      issues: [
        "RETELL_API_KEY missing or invalid — set it in your environment and restart.",
      ],
    };
  }

  if (params.agents.length === 0) {
    return {
      connectionState: "no_agents",
      issues: [
        "No agents in your Retell account. Go to /dashboard/agents and import a template.",
      ],
    };
  }

  if (params.phoneNumbers.length === 0) {
    return {
      connectionState: "no_phone_numbers",
      issues: [
        "No phone numbers in Retell. Buy one in the Retell dashboard at https://dashboard.retellai.com → Phone Numbers.",
      ],
    };
  }

  const agentIds = new Set(params.agents.map((agent) => agent.agent_id));
  const hasLinkedPair = params.phoneNumbers.some((phoneNumber) =>
    getRetellPhoneNumberAgentIds(phoneNumber).some((agentId) => agentIds.has(agentId))
  );

  if (!hasLinkedPair) {
    return {
      connectionState: "no_linked_pair",
      issues: [
        "You have phones and agents but none are linked. In Retell dashboard, edit a phone number and select the agent.",
      ],
    };
  }

  return {
    connectionState: "ok",
    issues: [],
  };
}

export function retellAgentName(agent: RetellConnectionAgent) {
  return agent.agent_name ?? agent.agentName ?? agent.name ?? agent.agent_id;
}

export function getRetellPhoneNumberAgentIds(phoneNumber: RetellConnectionPhoneNumber) {
  return [
    phoneNumber.agent_id,
    phoneNumber.inbound_agent_id,
    phoneNumber.outbound_agent_id,
    ...(phoneNumber.agent_ids ?? []),
    ...(phoneNumber.inbound_agent_ids ?? []),
    ...(phoneNumber.outbound_agent_ids ?? []),
  ].filter((agentId): agentId is string => Boolean(agentId));
}
