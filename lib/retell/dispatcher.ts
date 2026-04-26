import "server-only";

import {
  buildSettingsDynamicVariables,
  mergeRetellDynamicVariables,
} from "@/lib/retell/dynamic-variables";
import { createPhoneCall, getCall, RetellApiError } from "@/lib/retell/client";
import { supabaseAdmin } from "@/lib/supabase/admin";

type CampaignRow = {
  id: string;
  tenant_id: string;
  status: string;
  purpose: string;
  agent_id: string;
  from_phone: string;
  script_variables: Record<string, unknown> | null;
  max_concurrent: number;
  max_attempts_per_task: number;
  retry_delay_minutes: number;
  call_window_start: string | null;
  call_window_end: string | null;
  call_window_timezone: string | null;
};

type CallTaskRow = {
  id: string;
  tenant_id: string;
  campaign_id: string;
  lead_id: string | null;
  to_phone: string;
  contact_name: string | null;
  merge_fields: Record<string, unknown> | null;
  attempts: number;
};

type ActiveCallTaskRow = CallTaskRow & {
  last_retell_call_id: string | null;
};

type TenantRow = {
  name: string;
  agency_phone: string | null;
  agency_address: string | null;
};

type DispatchCounts = {
  launched: number;
  failed: number;
};

function serializeError(error: unknown) {
  if (error instanceof RetellApiError) {
    return {
      name: error.name,
      status: error.status,
      body: error.body,
    };
  }

  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message,
    };
  }

  return { message: String(error) };
}

async function insertCallEvent(params: {
  tenantId: string;
  leadId?: string | null;
  eventType: string;
  payload: Record<string, unknown>;
}) {
  try {
    await supabaseAdmin.from("call_events").insert({
      tenant_id: params.tenantId,
      call_id: null,
      lead_id: params.leadId ?? null,
      event_type: params.eventType,
      payload: params.payload,
    });
  } catch {
    // Dispatcher callers should never receive logging failures.
  }
}

function localTimeInMinutes(timeZone: string): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
    timeZone,
  }).formatToParts(new Date());

  const getPart = (type: string) => Number(parts.find((part) => part.type === type)?.value ?? 0);
  return getPart("hour") * 60 + getPart("minute") + getPart("second") / 60;
}

function timeStringToMinutes(value: string | null): number {
  const [hours = "0", minutes = "0", seconds = "0"] = (value ?? "00:00:00").split(":");
  return Number(hours) * 60 + Number(minutes) + Number(seconds) / 60;
}

function isWithinCallWindow(campaign: CampaignRow): boolean {
  const timeZone = campaign.call_window_timezone ?? "America/Detroit";
  const now = localTimeInMinutes(timeZone);
  const start = timeStringToMinutes(campaign.call_window_start ?? "09:00:00");
  const end = timeStringToMinutes(campaign.call_window_end ?? "20:00:00");

  if (start <= end) {
    return now >= start && now <= end;
  }

  return now >= start || now <= end;
}

function stringField(record: Record<string, unknown>, key: string) {
  const value = record[key];
  return typeof value === "string" && value ? value : null;
}

function numberField(record: Record<string, unknown>, key: string) {
  const value = record[key];
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function parseTimestamp(value: unknown) {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  const date =
    typeof value === "number"
      ? new Date(value > 10_000_000_000 ? value : value * 1000)
      : new Date(String(value));

  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function getDurationSeconds(record: Record<string, unknown>) {
  const durationSeconds = numberField(record, "duration_seconds");
  if (durationSeconds !== null) {
    return Math.round(durationSeconds);
  }

  const durationMs = numberField(record, "duration_ms");
  return durationMs !== null ? Math.round(durationMs / 1000) : null;
}

function terminalDispositionFromRetellCall(record: Record<string, unknown>) {
  const status = stringField(record, "call_status") ?? stringField(record, "status");
  const disconnectReason =
    stringField(record, "disconnect_reason") ?? stringField(record, "disconnection_reason");
  const endedAt = parseTimestamp(record.end_timestamp);
  const durationSeconds = getDurationSeconds(record) ?? 0;

  if (!endedAt && !disconnectReason && !["ended", "completed", "error"].includes(status ?? "")) {
    return null;
  }

  switch (disconnectReason) {
    case "user_hangup":
      return durationSeconds < 15 ? "voicemail_or_quick_hangup" : "answered_completed";
    case "agent_hangup":
      return "agent_completed";
    case "dial_no_answer":
    case "no_answer":
      return "no_answer";
    case "dial_busy":
      return "busy";
    case "dial_failed":
      return "dial_failed";
    case "voicemail":
      return "voicemail_left";
    default:
      return status === "completed" ? "answered_completed" : "other";
  }
}

function taskStatusFromDisposition(disposition: string, shouldRetryNoAnswer: boolean) {
  if (
    disposition === "answered_completed" ||
    disposition === "agent_completed" ||
    disposition === "voicemail_left"
  ) {
    return "completed";
  }

  if (shouldRetryNoAnswer) {
    return "scheduled";
  }

  if (disposition === "no_answer") {
    return "no_answer";
  }

  if (disposition === "busy") {
    return "busy";
  }

  if (disposition === "voicemail_or_quick_hangup") {
    return "voicemail";
  }

  return "failed";
}

export async function syncTerminalInProgressTasks(tenantId: string, campaign: CampaignRow) {
  const { data: activeTasks, error } = await supabaseAdmin
    .from("call_tasks")
    .select("id, tenant_id, campaign_id, lead_id, to_phone, merge_fields, attempts, last_retell_call_id")
    .eq("tenant_id", tenantId)
    .eq("campaign_id", campaign.id)
    .eq("status", "in_progress")
    .not("last_retell_call_id", "is", null)
    .limit(25)
    .returns<ActiveCallTaskRow[]>();

  if (error || !activeTasks) {
    return;
  }

  await Promise.all(
    activeTasks.map(async (task) => {
      if (!task.last_retell_call_id) {
        return;
      }

      try {
        const retellCall = (await getCall(task.last_retell_call_id)) as Record<string, unknown>;
        const disposition = terminalDispositionFromRetellCall(retellCall);
        if (!disposition) {
          return;
        }

        const shouldRetryNoAnswer =
          disposition === "no_answer" && task.attempts < campaign.max_attempts_per_task;
        const nextAttemptAt = shouldRetryNoAnswer
          ? new Date(Date.now() + campaign.retry_delay_minutes * 60_000).toISOString()
          : null;

        await supabaseAdmin
          .from("call_tasks")
          .update({
            status: taskStatusFromDisposition(disposition, shouldRetryNoAnswer),
            disposition,
            next_attempt_at: nextAttemptAt,
            updated_at: new Date().toISOString(),
          })
          .eq("id", task.id)
          .eq("tenant_id", tenantId);
      } catch (syncError) {
        await insertCallEvent({
          tenantId,
          leadId: task.lead_id,
          eventType: "outbound_dispatch_error",
          payload: {
            campaign_id: campaign.id,
            call_task_id: task.id,
            error: serializeError(syncError),
          },
        });
      }
    })
  );
}

function recordFromUnknown(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function nameVariables(contactName: string | null): Record<string, string> {
  if (!contactName) {
    return {};
  }

  const parts = contactName.trim().split(/\s+/).filter(Boolean);
  return {
    contact_name: contactName,
    full_name: contactName,
    first_name: parts[0] ?? contactName,
    last_name: parts.length > 1 ? parts.slice(1).join(" ") : "",
    client_name: contactName,
  };
}

async function loadTemplateVariablesForAgent(tenantId: string, agentId: string) {
  const { data: importRow } = await supabaseAdmin
    .from("agent_template_imports")
    .select("template_id, retell_response")
    .eq("tenant_id", tenantId)
    .eq("retell_agent_id", agentId)
    .eq("status", "success")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle<{
      template_id: string;
      retell_response: Record<string, unknown> | null;
    }>();

  if (!importRow) {
    return {
      templateDefaultVariables: {},
      importTimeVariables: {},
    };
  }

  const { data: template } = await supabaseAdmin
    .from("agent_templates")
    .select("default_variables")
    .eq("id", importRow.template_id)
    .maybeSingle<{ default_variables: Record<string, unknown> | null }>();

  return {
    templateDefaultVariables: template?.default_variables ?? {},
    importTimeVariables: recordFromUnknown(importRow.retell_response?.variables),
  };
}

async function scheduleFailedTask(params: {
  task: CallTaskRow;
  campaign: CampaignRow;
  disposition: string;
  retry: boolean;
}) {
  const retryAt = new Date(Date.now() + params.campaign.retry_delay_minutes * 60_000).toISOString();

  await supabaseAdmin
    .from("call_tasks")
    .update({
      status: params.retry ? "scheduled" : "failed",
      disposition: params.disposition,
      next_attempt_at: params.retry ? retryAt : null,
    })
    .eq("id", params.task.id)
    .eq("tenant_id", params.task.tenant_id);
}

export async function dispatchCampaignCalls(
  tenantId: string,
  campaignId: string,
  limit: number
): Promise<DispatchCounts> {
  const counts: DispatchCounts = { launched: 0, failed: 0 };

  try {
    const { data: campaign, error: campaignError } = await supabaseAdmin
      .from("campaigns")
      .select(
        "id, tenant_id, status, purpose, agent_id, from_phone, script_variables, max_concurrent, max_attempts_per_task, retry_delay_minutes, call_window_start, call_window_end, call_window_timezone"
      )
      .eq("tenant_id", tenantId)
      .eq("id", campaignId)
      .single<CampaignRow>();

    if (campaignError || !campaign) {
      await insertCallEvent({
        tenantId,
        eventType: "outbound_dispatch_error",
        payload: {
          campaign_id: campaignId,
          error: campaignError?.message ?? "Campaign not found",
        },
      });
      return counts;
    }

    const { data: tenant, error: tenantError } = await supabaseAdmin
      .from("tenants")
      .select("name, agency_phone, agency_address")
      .eq("id", tenantId)
      .single<TenantRow>();

    if (tenantError || !tenant) {
      await insertCallEvent({
        tenantId,
        eventType: "outbound_dispatch_error",
        payload: {
          campaign_id: campaignId,
          error: tenantError?.message ?? "Tenant not found",
        },
      });
      return counts;
    }

    if (campaign.status !== "running" || !isWithinCallWindow(campaign)) {
      return counts;
    }

    const settingsVariables = buildSettingsDynamicVariables({
      tenant,
      campaignPurpose: campaign.purpose,
    });
    const { templateDefaultVariables, importTimeVariables } =
      await loadTemplateVariablesForAgent(tenantId, campaign.agent_id);

    await syncTerminalInProgressTasks(tenantId, campaign);

    const { count: inProgressCount, error: countError } = await supabaseAdmin
      .from("call_tasks")
      .select("id", { count: "exact", head: true })
      .eq("tenant_id", tenantId)
      .eq("campaign_id", campaignId)
      .eq("status", "in_progress");

    if (countError) {
      await insertCallEvent({
        tenantId,
        eventType: "outbound_dispatch_error",
        payload: {
          campaign_id: campaignId,
          error: countError.message,
        },
      });
      return counts;
    }

    const availableSlots = Math.min(
      Math.max(campaign.max_concurrent - (inProgressCount ?? 0), 0),
      Math.max(limit, 0)
    );

    if (availableSlots <= 0) {
      return counts;
    }

    const { data: claimedTasks, error: claimError } = await supabaseAdmin
      .rpc("claim_next_call_tasks", {
        p_tenant_id: tenantId,
        p_campaign_id: campaignId,
        p_limit: availableSlots,
      });

    if (claimError) {
      await insertCallEvent({
        tenantId,
        eventType: "outbound_dispatch_error",
        payload: {
          campaign_id: campaignId,
          error: claimError.message,
        },
      });
      return counts;
    }

    const tasks = (Array.isArray(claimedTasks) ? claimedTasks : []) as CallTaskRow[];

    for (const task of tasks) {
      try {
        const response = await createPhoneCall({
          from_number: campaign.from_phone,
          to_number: task.to_phone,
          override_agent_id: campaign.agent_id,
          metadata: {
            tenant_id: tenantId,
            campaign_id: campaignId,
            call_task_id: task.id,
          },
          retell_llm_dynamic_variables: mergeRetellDynamicVariables(
            settingsVariables,
            templateDefaultVariables,
            importTimeVariables,
            campaign.script_variables,
            nameVariables(task.contact_name),
            task.merge_fields
          ),
        });

        await supabaseAdmin
          .from("call_tasks")
          .update({ last_retell_call_id: response.call_id })
          .eq("id", task.id)
          .eq("tenant_id", tenantId);

        await insertCallEvent({
          tenantId,
          leadId: task.lead_id,
          eventType: "outbound_dispatched",
          payload: {
            call_task_id: task.id,
            retell_call_id_or_error: response.call_id,
          },
        });

        counts.launched += 1;
      } catch (error) {
        const isRetellError = error instanceof RetellApiError;
        const disposition = isRetellError ? `retell_error_${error.status}` : "dispatch_error";
        const retry = task.attempts < campaign.max_attempts_per_task;

        try {
          await scheduleFailedTask({
            task,
            campaign,
            disposition,
            retry,
          });
        } catch (updateError) {
          await insertCallEvent({
            tenantId,
            leadId: task.lead_id,
            eventType: "outbound_dispatch_error",
            payload: {
              campaign_id: campaignId,
              call_task_id: task.id,
              error: serializeError(updateError),
            },
          });
        }

        await insertCallEvent({
          tenantId,
          leadId: task.lead_id,
          eventType: "outbound_dispatched",
          payload: {
            call_task_id: task.id,
            retell_call_id_or_error: serializeError(error),
          },
        });

        counts.failed += 1;
      }
    }

    return counts;
  } catch (error) {
    await insertCallEvent({
      tenantId,
      eventType: "outbound_dispatch_error",
      payload: {
        campaign_id: campaignId,
        error: serializeError(error),
      },
    });
    return counts;
  }
}
