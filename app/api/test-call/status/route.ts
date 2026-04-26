import { getCurrentUser } from "@/lib/auth";
import { normalizePhone } from "@/lib/phone";
import { getCall } from "@/lib/retell/client";
import { supabaseAdmin } from "@/lib/supabase/admin";

export const runtime = "nodejs";

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
  lead_id: string | null;
  created_at: string | null;
  duration_seconds: number | null;
  transcript: string | null;
  extraction: unknown | null;
};

function parseTimestamp(value: unknown) {
  if (value === null || value === undefined) {
    return null;
  }

  const date =
    typeof value === "number"
      ? new Date(value > 10_000_000_000 ? value : value * 1000)
      : typeof value === "string"
        ? new Date(value)
        : null;

  return date && !Number.isNaN(date.getTime()) ? date.toISOString() : null;
}

function stringField(record: Record<string, unknown>, key: string) {
  const value = record[key];
  return typeof value === "string" ? value : null;
}

function numberField(record: Record<string, unknown>, key: string) {
  const value = record[key];
  return typeof value === "number" ? value : null;
}

function getDurationSeconds(record: Record<string, unknown>) {
  const seconds = numberField(record, "duration_seconds");
  if (seconds !== null) {
    return Math.round(seconds);
  }

  const ms = numberField(record, "duration_ms");
  return ms !== null ? Math.round(ms / 1000) : null;
}

function retellTerminalStatus(record: Record<string, unknown>) {
  const status = stringField(record, "call_status") ?? stringField(record, "status");
  const disconnectReason =
    stringField(record, "disconnect_reason") ?? stringField(record, "disconnection_reason");
  const endedAt = parseTimestamp(record.end_timestamp);
  const duration = getDurationSeconds(record);

  if (status && ["ended", "completed", "done"].includes(status)) {
    return "completed";
  }

  if (status && ["error", "failed"].includes(status)) {
    return "failed";
  }

  if (endedAt || disconnectReason || duration !== null || stringField(record, "transcript")) {
    return "completed";
  }

  return null;
}

async function syncRetellCall(params: {
  task: TaskRow;
  tenantId: string;
  campaignIds: string[];
  origin: string;
}) {
  if (!params.task.last_retell_call_id) {
    return null;
  }

  const retellCall = (await getCall(params.task.last_retell_call_id).catch(() => null)) as Record<
    string,
    unknown
  > | null;
  if (!retellCall) {
    return null;
  }

  const metadata =
    retellCall.metadata && typeof retellCall.metadata === "object"
      ? (retellCall.metadata as Record<string, unknown>)
      : {};
  const campaignId = stringField(metadata, "campaign_id");
  const callerPhone = stringField(retellCall, "to_number");
  const transcript = stringField(retellCall, "transcript");
  const terminalStatus = retellTerminalStatus(retellCall);

  const { data } = await supabaseAdmin
    .from("intake_calls")
    .upsert(
      {
        tenant_id: params.tenantId,
        retell_call_id: params.task.last_retell_call_id,
        caller_phone: callerPhone,
        caller_phone_normalized: callerPhone ? normalizePhone(callerPhone) : null,
        call_started_at: parseTimestamp(retellCall.start_timestamp),
        call_ended_at: parseTimestamp(retellCall.end_timestamp),
        duration_seconds: getDurationSeconds(retellCall),
        transcript,
        recording_url: stringField(retellCall, "recording_url"),
        disconnect_reason:
          stringField(retellCall, "disconnect_reason") ??
          stringField(retellCall, "disconnection_reason"),
        call_direction: "outbound",
        campaign_id:
          campaignId && params.campaignIds.includes(campaignId) ? campaignId : params.campaignIds[0],
        call_task_id: params.task.id,
      },
      { onConflict: "retell_call_id" }
    )
    .select("id, retell_call_id, lead_id, created_at, duration_seconds, transcript, extraction")
    .single<CallRow>();

  if (terminalStatus && ["queued", "scheduled", "in_progress"].includes(params.task.status)) {
    await supabaseAdmin
      .from("call_tasks")
      .update({
        status: terminalStatus,
        disposition:
          terminalStatus === "completed"
            ? "answered_completed"
            : stringField(retellCall, "disconnect_reason") ?? "retell_failed",
        updated_at: new Date().toISOString(),
      })
      .eq("id", params.task.id)
      .eq("tenant_id", params.tenantId);

    params.task.status = terminalStatus;
    params.task.disposition =
      terminalStatus === "completed"
        ? "answered_completed"
        : stringField(retellCall, "disconnect_reason") ?? "retell_failed";
  }

  if (data?.id && transcript && !data.extraction && process.env.INTERNAL_API_SECRET) {
    void fetch(`${params.origin}/api/retell/extract`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-internal-secret": process.env.INTERNAL_API_SECRET,
      },
      body: JSON.stringify({ call_id: data.id }),
    }).catch(() => null);
  }

  return data ?? null;
}

function scenarioLabel(task: TaskRow) {
  const description = task.merge_fields?.scenario_description;
  return typeof description === "string" ? description : "test call";
}

export async function GET(request: Request) {
  const current = await getCurrentUser().catch(() => null);
  if (!current) {
    return new Response(null, { status: 401 });
  }

  const taskId = new URL(request.url).searchParams.get("task_id");
  const { data: campaigns } = await supabaseAdmin
    .from("campaigns")
    .select("id")
    .eq("tenant_id", current.profile.tenant_id)
    .eq("name", "Self-test")
    .eq("purpose", "test")
    .returns<Array<{ id: string }>>();
  const campaignIds = (campaigns ?? []).map((campaign) => campaign.id);

  if (campaignIds.length === 0) {
    return Response.json({ task: null, recent: [] });
  }

  let currentTask: TaskRow | null = null;
  if (taskId) {
    const { data } = await supabaseAdmin
      .from("call_tasks")
      .select("id, status, disposition, last_retell_call_id, created_at, merge_fields")
      .eq("tenant_id", current.profile.tenant_id)
      .eq("id", taskId)
      .in("campaign_id", campaignIds)
      .single<TaskRow>();
    currentTask = data ?? null;
  }

  const { data: recentTasks } = await supabaseAdmin
    .from("call_tasks")
    .select("id, status, disposition, last_retell_call_id, created_at, merge_fields")
    .eq("tenant_id", current.profile.tenant_id)
    .in("campaign_id", campaignIds)
    .order("created_at", { ascending: false })
    .limit(10)
    .returns<TaskRow[]>();
  const retellIds = (recentTasks ?? [])
    .concat(currentTask ? [currentTask] : [])
    .map((task) => task.last_retell_call_id)
    .filter((id): id is string => Boolean(id));
  const { data: calls } =
    retellIds.length > 0
      ? await supabaseAdmin
          .from("intake_calls")
          .select("id, retell_call_id, lead_id, created_at, duration_seconds, transcript, extraction")
          .eq("tenant_id", current.profile.tenant_id)
          .in("retell_call_id", retellIds)
          .returns<CallRow[]>()
      : { data: [] as CallRow[] };
  const callByRetellId = new Map((calls ?? []).map((call) => [call.retell_call_id, call]));
  const tasksNeedingSync = (recentTasks ?? [])
    .concat(currentTask ? [currentTask] : [])
    .filter((task) => {
      if (!task.last_retell_call_id) {
        return false;
      }

      const call = callByRetellId.get(task.last_retell_call_id);
      if (!call) {
        return true;
      }

      return (
        ["queued", "scheduled", "in_progress"].includes(task.status) ||
        (task.status === "completed" && (!call.transcript || !call.extraction))
      );
    });

  await Promise.all(
    tasksNeedingSync.map(async (task) => {
      const call = await syncRetellCall({
        task,
        tenantId: current.profile.tenant_id,
        campaignIds,
        origin: new URL(request.url).origin,
      });
      if (call) {
        callByRetellId.set(call.retell_call_id, call);
      }
    })
  );

  const serialize = (task: TaskRow) => {
    const call = task.last_retell_call_id ? callByRetellId.get(task.last_retell_call_id) : null;
    return {
      id: task.id,
      status: task.status,
      disposition: task.disposition,
      created_at: task.created_at,
      scenario: scenarioLabel(task),
      call_id: call?.id ?? null,
      call_href: call ? `/dashboard/calls/${call.id}` : null,
      lead_href: call?.lead_id ? `/dashboard/leads/${call.lead_id}` : null,
      duration_seconds: call?.duration_seconds ?? null,
      transcript: call?.transcript ?? null,
      extraction: call?.extraction ?? null,
      has_extraction: Boolean(call?.extraction),
    };
  };

  return Response.json({
    task: currentTask ? serialize(currentTask) : null,
    recent: (recentTasks ?? []).map(serialize),
  });
}
