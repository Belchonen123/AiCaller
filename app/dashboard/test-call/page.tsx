import { TestCallClient } from "@/app/dashboard/test-call/test-call-client";
import { getCurrentUser } from "@/lib/auth";
import { testCallScenarios } from "@/lib/campaigns/test-scenarios";
import {
  getRetellConnectionStatus,
  getRetellPhoneNumberAgentIds,
} from "@/lib/retell/connection-state";
import { listAgents, listPhoneNumbers } from "@/lib/retell/client";
import { supabaseAdmin } from "@/lib/supabase/admin";

type TaskRow = {
  id: string;
  status: string;
  disposition: string | null;
  last_retell_call_id: string | null;
  created_at: string | null;
  merge_fields: Record<string, unknown> | null;
};

type CallRow = {
  id: string;
  retell_call_id: string;
  duration_seconds: number | null;
  extraction: unknown | null;
};

function scenarioLabel(task: TaskRow) {
  const description = task.merge_fields?.scenario_description;
  return typeof description === "string" ? description : "test call";
}

async function loadRetellDefaults() {
  const [agentsResult, phoneNumbersResult] = await Promise.allSettled([
    listAgents(),
    listPhoneNumbers(),
  ]);
  const agents = agentsResult.status === "fulfilled" ? agentsResult.value : [];
  const phoneNumbers =
    phoneNumbersResult.status === "fulfilled" ? phoneNumbersResult.value : [];
  const connection = getRetellConnectionStatus({
    agents,
    phoneNumbers,
    agentsLoadFailed: agentsResult.status === "rejected",
    phoneNumbersLoadFailed: phoneNumbersResult.status === "rejected",
  });
  const agentIds = new Set(agents.map((agent) => agent.agent_id));
  const linkedPhoneNumber = phoneNumbers.find((phoneNumber) =>
    getRetellPhoneNumberAgentIds(phoneNumber).some((agentId) => agentIds.has(agentId))
  );
  const linkedAgentId = linkedPhoneNumber
    ? getRetellPhoneNumberAgentIds(linkedPhoneNumber).find((agentId) => agentIds.has(agentId))
    : undefined;
  const linkedAgent = linkedAgentId
    ? agents.find((agent) => agent.agent_id === linkedAgentId)
    : null;

  return {
    agentId:
      linkedAgent?.agent_id ??
      agents[0]?.agent_id ??
      process.env.RETELL_OUTBOUND_AGENT_ID ??
      process.env.RETELL_AGENT_ID ??
      "",
    fromPhone:
      linkedPhoneNumber?.phone_number ??
      phoneNumbers.find((phoneNumber) =>
        getRetellPhoneNumberAgentIds(phoneNumber).includes(agents[0]?.agent_id ?? "")
      )?.phone_number ??
      process.env.RETELL_OUTBOUND_PHONE_NUMBER ??
      process.env.RETELL_FROM_PHONE ??
      process.env.RETELL_PHONE_NUMBER ??
      "",
    connectionState: connection.connectionState,
    issues: connection.issues,
    phoneNumbers,
    agents,
  };
}

async function loadRecentTestCalls(tenantId: string) {
  const { data: campaigns } = await supabaseAdmin
    .from("campaigns")
    .select("id")
    .eq("tenant_id", tenantId)
    .eq("name", "Self-test")
    .eq("purpose", "test")
    .returns<Array<{ id: string }>>();
  const campaignIds = (campaigns ?? []).map((campaign) => campaign.id);

  if (campaignIds.length === 0) {
    return [];
  }

  const { data: tasks } = await supabaseAdmin
    .from("call_tasks")
    .select("id, status, disposition, last_retell_call_id, created_at, merge_fields")
    .eq("tenant_id", tenantId)
    .in("campaign_id", campaignIds)
    .order("created_at", { ascending: false })
    .limit(10)
    .returns<TaskRow[]>();
  const retellIds = (tasks ?? [])
    .map((task) => task.last_retell_call_id)
    .filter((id): id is string => Boolean(id));
  const { data: calls } =
    retellIds.length > 0
      ? await supabaseAdmin
          .from("intake_calls")
          .select("id, retell_call_id, duration_seconds, extraction")
          .eq("tenant_id", tenantId)
          .in("retell_call_id", retellIds)
          .returns<CallRow[]>()
      : { data: [] as CallRow[] };
  const callByRetellId = new Map((calls ?? []).map((call) => [call.retell_call_id, call]));

  return (tasks ?? []).map((task) => {
    const call = task.last_retell_call_id ? callByRetellId.get(task.last_retell_call_id) : null;
    return {
      id: task.id,
      status: task.status,
      disposition: task.disposition,
      scenario: scenarioLabel(task),
      created_at: task.created_at,
      call_href: call ? `/dashboard/calls/${call.id}` : null,
      duration_seconds: call?.duration_seconds ?? null,
      extraction: call?.extraction ?? null,
      has_extraction: Boolean(call?.extraction),
    };
  });
}

export default async function TestCallPage() {
  const current = await getCurrentUser();
  const [{ data: profile }, retellDefaults, recent] = await Promise.all([
    supabaseAdmin
      .from("profiles")
      .select("test_phone")
      .eq("id", current.profile.id)
      .single<{ test_phone: string | null }>(),
    loadRetellDefaults(),
    loadRecentTestCalls(current.profile.tenant_id),
  ]);

  return (
    <div className="relative">
      <TestCallClient
        defaultPhone={profile?.test_phone ?? ""}
        scenarios={testCallScenarios}
        agentId={retellDefaults.agentId}
        fromPhone={retellDefaults.fromPhone}
        connectionState={retellDefaults.connectionState}
        issues={retellDefaults.issues}
        agents={retellDefaults.agents}
        phoneNumbers={retellDefaults.phoneNumbers}
        initialRecent={recent}
      />
    </div>
  );
}
