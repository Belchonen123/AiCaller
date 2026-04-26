"use server";

import { z } from "zod";
import { dispatchCampaignCalls } from "@/lib/retell/dispatcher";
import { getCurrentUser } from "@/lib/auth";
import { getTestCallScenario } from "@/lib/campaigns/test-scenarios";
import { normalizePhone } from "@/lib/phone";
import { supabaseAdmin } from "@/lib/supabase/admin";

const placeCallNowSchema = z.object({
  phone: z.string().trim().min(1),
  scenario_id: z.string().trim().min(1),
  custom_script_variables: z.string().trim().optional(),
  test_dynamic_variables: z.record(z.string(), z.string()).optional(),
  save_default_phone: z.boolean().optional(),
  agent_id: z.string().trim().min(1),
  from_phone: z.string().trim().min(1),
});

function parseCustomVariables(value: string | undefined) {
  if (!value) {
    return {};
  }

  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function getString(value: unknown) {
  return typeof value === "string" ? value : null;
}

function getStatusCode(value: unknown) {
  return typeof value === "number" ? value : null;
}

function diagnosticMessageFromEvent(payload: unknown) {
  const record = asRecord(payload);
  const error = record?.error ?? record?.retell_call_id_or_error;
  const errorRecord = asRecord(error);
  const status = getStatusCode(errorRecord?.status);
  const name = getString(errorRecord?.name);
  const message = getString(errorRecord?.message) ?? getString(error);

  if (name === "RetellApiError" && status === 401) {
    return "Retell rejected the request — check your API key.";
  }

  if (name === "RetellApiError" && status === 404) {
    return "Agent or phone number not found in Retell. Refresh /dashboard/setup.";
  }

  if (name === "RetellApiError" && status === 400) {
    return "Retell rejected the call parameters. The from_phone must be linked to the agent_id in Retell dashboard.";
  }

  if (message === "Campaign not found") {
    return "Campaign was deleted before launch. Try again.";
  }

  if (status) {
    return `Retell dispatch failed with status ${status}.`;
  }

  return null;
}

async function loadRecentDispatchDiagnostic(tenantId: string) {
  const since = new Date(Date.now() - 60_000).toISOString();
  const { data } = await supabaseAdmin
    .from("call_events")
    .select("payload")
    .eq("tenant_id", tenantId)
    .in("event_type", ["outbound_dispatch_error", "outbound_dispatched"])
    .gte("created_at", since)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle<{ payload: unknown }>();

  return data ? diagnosticMessageFromEvent(data.payload) : null;
}

async function findOrCreateSelfTestCampaign(params: {
  tenantId: string;
  userId: string;
  agentId: string;
  fromPhone: string;
}) {
  const existing = await supabaseAdmin
    .from("campaigns")
    .select("id")
    .eq("tenant_id", params.tenantId)
    .eq("name", "Self-test")
    .eq("purpose", "test")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle<{ id: string }>();

  if (existing.data) {
    await supabaseAdmin
      .from("campaigns")
      .update({
        agent_id: params.agentId,
        from_phone: params.fromPhone,
        status: "running",
        max_concurrent: 1,
        max_attempts_per_task: 1,
        retry_delay_minutes: 5,
        call_window_start: "00:00:00",
        call_window_end: "23:59:59",
        call_window_timezone: "America/Detroit",
        started_at: new Date().toISOString(),
      })
      .eq("tenant_id", params.tenantId)
      .eq("id", existing.data.id);

    return existing.data.id;
  }

  const { data, error } = await supabaseAdmin
    .from("campaigns")
    .insert({
      tenant_id: params.tenantId,
      name: "Self-test",
      purpose: "test",
      agent_id: params.agentId,
      from_phone: params.fromPhone,
      status: "running",
      max_concurrent: 1,
      max_attempts_per_task: 1,
      retry_delay_minutes: 5,
      call_window_start: "00:00:00",
      call_window_end: "23:59:59",
      call_window_timezone: "America/Detroit",
      created_by: params.userId,
      started_at: new Date().toISOString(),
    })
    .select("id")
    .single<{ id: string }>();

  if (error || !data) {
    throw new Error("Unable to create self-test campaign");
  }

  return data.id;
}

export async function placeCallNow(input: unknown): Promise<{
  ok: boolean;
  message: string;
  call_task_id?: string;
  retell_call_id_or_error?: string;
}> {
  const parsed = placeCallNowSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, message: "Enter a valid phone, scenario, agent, and from number." };
  }

  const current = await getCurrentUser();
  const normalizedPhone = normalizePhone(parsed.data.phone);
  if (!normalizedPhone) {
    return { ok: false, message: "Enter a valid phone number." };
  }

  const scenario = getTestCallScenario(parsed.data.scenario_id);
  const customVariables =
    scenario.id === "custom" ? parseCustomVariables(parsed.data.custom_script_variables) : {};

  if (!customVariables) {
    return { ok: false, message: "Custom script variables must be a JSON object." };
  }

  if (parsed.data.save_default_phone) {
    await supabaseAdmin
      .from("profiles")
      .update({ test_phone: normalizedPhone })
      .eq("id", current.profile.id)
      .eq("tenant_id", current.profile.tenant_id);
  }

  const campaignId = await findOrCreateSelfTestCampaign({
    tenantId: current.profile.tenant_id,
    userId: current.profile.id,
    agentId: parsed.data.agent_id,
    fromPhone: parsed.data.from_phone,
  });

  await supabaseAdmin
    .from("call_tasks")
    .update({
      status: "cancelled",
      disposition: "superseded_by_new_test_call",
      updated_at: new Date().toISOString(),
    })
    .eq("tenant_id", current.profile.tenant_id)
    .eq("campaign_id", campaignId)
    .in("status", ["queued", "scheduled", "in_progress"]);

  const mergeFields = {
    ...scenario.merge_fields,
    ...customVariables,
    ...(parsed.data.test_dynamic_variables ?? {}),
    mode: "test_outbound",
    test_call: "true",
    tester_name: current.profile.full_name ?? current.profile.email,
  };

  const { data: task, error: taskError } = await supabaseAdmin
    .from("call_tasks")
    .insert({
      tenant_id: current.profile.tenant_id,
      campaign_id: campaignId,
      to_phone: normalizedPhone,
      to_phone_raw: parsed.data.phone,
      contact_name: current.profile.full_name || "Test caller",
      merge_fields: mergeFields,
      status: "queued",
    })
    .select("id")
    .single<{ id: string }>();

  if (taskError || !task) {
    return { ok: false, message: "Unable to create test call task." };
  }

  const dispatchResult = await dispatchCampaignCalls(current.profile.tenant_id, campaignId, 1);

  const { data: updatedTask } = await supabaseAdmin
    .from("call_tasks")
    .select("last_retell_call_id, disposition")
    .eq("tenant_id", current.profile.tenant_id)
    .eq("id", task.id)
    .single<{ last_retell_call_id: string | null; disposition: string | null }>();

  if (dispatchResult.launched === 0) {
    const diagnosticMessage = await loadRecentDispatchDiagnostic(current.profile.tenant_id);

    return {
      ok: false,
      message:
        diagnosticMessage ||
        updatedTask?.disposition ||
        "The test call task was created, but Retell did not launch the call. Check that the selected from number is linked to the selected agent.",
      call_task_id: task.id,
      retell_call_id_or_error: updatedTask?.disposition ?? "not_dispatched",
    };
  }

  return {
    ok: true,
    message: "Calling now. Your phone will ring in ~5 seconds.",
    call_task_id: task.id,
    retell_call_id_or_error:
      updatedTask?.last_retell_call_id ?? updatedTask?.disposition ?? "queued",
  };
}

export async function cancelTestCall(input: unknown): Promise<{
  ok: boolean;
  message: string;
}> {
  const parsed = z.object({ task_id: z.uuid() }).safeParse(input);
  if (!parsed.success) {
    return { ok: false, message: "Invalid test call." };
  }

  const current = await getCurrentUser();
  const { error } = await supabaseAdmin
    .from("call_tasks")
    .update({
      status: "cancelled",
      disposition: "cancelled_by_user",
      updated_at: new Date().toISOString(),
    })
    .eq("tenant_id", current.profile.tenant_id)
    .eq("id", parsed.data.task_id)
    .in("status", ["queued", "scheduled", "in_progress"]);

  if (error) {
    return { ok: false, message: "Unable to cancel the test call." };
  }

  return { ok: true, message: "Test call cancelled." };
}
