import { createHmac, timingSafeEqual } from "node:crypto";
import { z } from "zod";
import { normalizePhone } from "@/lib/phone";
import { dispatchCampaignCalls } from "@/lib/retell/dispatcher";
import { supabaseAdmin } from "@/lib/supabase/admin";

export const runtime = "nodejs";

const timestampSchema = z.union([z.string(), z.number()]).nullable().optional();

const retellCallSchema = z
  .object({
    call_id: z.string().min(1),
    from_number: z.string().nullable().optional(),
    to_number: z.string().nullable().optional(),
    start_timestamp: timestampSchema,
    end_timestamp: timestampSchema,
    duration_ms: z.number().nullable().optional(),
    duration_seconds: z.number().nullable().optional(),
    transcript: z.string().nullable().optional(),
    recording_url: z.string().nullable().optional(),
    disconnection_reason: z.string().nullable().optional(),
    disconnect_reason: z.string().nullable().optional(),
    direction: z.enum(["inbound", "outbound"]).nullable().optional(),
    metadata: z
      .object({
        tenant_id: z.string().uuid().optional(),
        campaign_id: z.string().uuid().optional(),
        call_task_id: z.string().uuid().optional(),
      })
      .passthrough()
      .nullable()
      .optional(),
  })
  .passthrough();

const retellWebhookSchema = z.discriminatedUnion("event", [
  z
    .object({
      event: z.literal("call_started"),
      call: retellCallSchema,
    })
    .passthrough(),
  z
    .object({
      event: z.literal("call_ended"),
      call: retellCallSchema,
    })
    .passthrough(),
  z
    .object({
      event: z.literal("call_analyzed"),
      call: retellCallSchema,
    })
    .passthrough(),
]);

type RetellWebhookEvent = z.infer<typeof retellWebhookSchema>;

type IntakeCallRow = {
  id: string;
  lead_id?: string | null;
  call_task_id?: string | null;
};

type CallContext = {
  tenantId: string;
  campaignId: string | null;
  callTaskId: string | null;
  isOutbound: boolean;
};

type OutboundDisposition =
  | "voicemail_or_quick_hangup"
  | "answered_completed"
  | "agent_completed"
  | "no_answer"
  | "busy"
  | "dial_failed"
  | "voicemail_left"
  | "other";

const safeLogSchema = z.object({
  event: z.enum(["call_started", "call_ended", "call_analyzed"]).optional(),
  call: z
    .object({
      call_id: z.string().optional(),
      metadata: z
        .object({
          call_task_id: z.string().uuid().optional(),
        })
        .passthrough()
        .nullable()
        .optional(),
    })
    .optional(),
});

function methodNotAllowed() {
  return new Response(null, {
    status: 405,
    headers: {
      Allow: "POST",
    },
  });
}

export const GET = methodNotAllowed;
export const PUT = methodNotAllowed;
export const PATCH = methodNotAllowed;
export const DELETE = methodNotAllowed;
export const OPTIONS = methodNotAllowed;

function getRequiredEnv(name: string): string {
  const value = process.env[name];

  if (!value) {
    throw new Error(`${name} is required`);
  }

  return value;
}

function timingSafeCompare(candidate: string, expected: string): boolean {
  const candidateBuffer = Buffer.from(candidate);
  const expectedBuffer = Buffer.from(expected);

  if (candidateBuffer.length !== expectedBuffer.length) {
    return false;
  }

  return timingSafeEqual(candidateBuffer, expectedBuffer);
}

function verifySignature(rawBody: string, signature: string | null): boolean {
  if (!signature) {
    return false;
  }

  const secret = getRequiredEnv("RETELL_WEBHOOK_SECRET");
  const hmac = createHmac("sha256", secret).update(rawBody);
  const expectedHex = hmac.digest("hex");
  const expectedBase64 = createHmac("sha256", secret)
    .update(rawBody)
    .digest("base64");
  const normalizedSignature = signature.trim().replace(/^sha256=/, "");

  return (
    timingSafeCompare(normalizedSignature, expectedHex) ||
    timingSafeCompare(normalizedSignature, expectedBase64)
  );
}

function parseTimestamp(value: string | number | null | undefined) {
  if (value === null || value === undefined) {
    return null;
  }

  const date =
    typeof value === "number"
      ? new Date(value > 10_000_000_000 ? value : value * 1000)
      : new Date(value);

  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return date.toISOString();
}

function getDurationSeconds(event: RetellWebhookEvent) {
  const durationSeconds = event.call.duration_seconds;

  if (typeof durationSeconds === "number") {
    return Math.round(durationSeconds);
  }

  const durationMs = event.call.duration_ms;

  if (typeof durationMs === "number") {
    return Math.round(durationMs / 1000);
  }

  return null;
}

function getDisconnectReason(event: RetellWebhookEvent) {
  return event.call.disconnect_reason ?? event.call.disconnection_reason ?? null;
}

function getCallContext(event: RetellWebhookEvent): CallContext {
  const metadata = event.call.metadata;
  const isOutbound = event.call.direction === "outbound" || Boolean(metadata?.call_task_id);

  if (isOutbound) {
    if (!metadata?.tenant_id) {
      throw new Error("Outbound Retell webhook missing tenant metadata");
    }

    return {
      tenantId: metadata.tenant_id,
      campaignId: metadata.campaign_id ?? null,
      callTaskId: metadata.call_task_id ?? null,
      isOutbound: true,
    };
  }

  // TODO: Replace with agent_id -> tenant mapping when multi-tenant inbound ships.
  return {
    tenantId: getRequiredEnv("DEMO_TENANT_ID"),
    campaignId: null,
    callTaskId: null,
    isOutbound: false,
  };
}

function getOutboundDisposition(event: RetellWebhookEvent): OutboundDisposition {
  const reason = getDisconnectReason(event);
  const durationSeconds = getDurationSeconds(event) ?? 0;

  switch (reason) {
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
      return "other";
  }
}

function getStoredCallerPhone(event: RetellWebhookEvent, context: CallContext) {
  return context.isOutbound
    ? event.call.to_number ?? null
    : event.call.from_number ?? null;
}

function getSafeLogFields(payload: unknown) {
  const parsed = safeLogSchema.safeParse(payload);

  return {
    event: parsed.success ? parsed.data.event ?? "unknown" : "unknown",
    call_id: parsed.success ? parsed.data.call?.call_id ?? "unknown" : "unknown",
    call_task_id: parsed.success ? parsed.data.call?.metadata?.call_task_id ?? null : null,
    disposition: null,
  };
}

async function insertCallEvent(params: {
  tenantId: string;
  callId: string;
  event: RetellWebhookEvent["event"];
  retellCallId: string;
  callTaskId?: string | null;
  disposition?: string | null;
}) {
  const { error } = await supabaseAdmin.from("call_events").insert({
    tenant_id: params.tenantId,
    call_id: params.callId,
    event_type: params.event,
    payload: {
      event: params.event,
      call_id: params.retellCallId,
      call_task_id: params.callTaskId ?? null,
      disposition: params.disposition ?? null,
    },
  });

  if (error) {
    throw new Error("Failed to insert call event");
  }
}

async function handleCallStarted(event: RetellWebhookEvent, context: CallContext) {
  const callerPhone = getStoredCallerPhone(event, context);
  const { data, error } = await supabaseAdmin
    .from("intake_calls")
    .upsert(
      {
        tenant_id: context.tenantId,
        retell_call_id: event.call.call_id,
        caller_phone: callerPhone,
        caller_phone_normalized: callerPhone ? normalizePhone(callerPhone) : null,
        call_started_at: parseTimestamp(event.call.start_timestamp),
        call_direction: context.isOutbound ? "outbound" : "inbound",
        campaign_id: context.campaignId,
        call_task_id: context.callTaskId,
        status: "received",
      },
      {
        onConflict: "retell_call_id",
      }
    )
    .select("id")
    .single<IntakeCallRow>();

  if (error || !data) {
    throw new Error("Failed to upsert started call");
  }

  await insertCallEvent({
    tenantId: context.tenantId,
    callId: data.id,
    event: event.event,
    retellCallId: event.call.call_id,
    callTaskId: context.callTaskId,
  });
}

async function updateOutboundTaskOnCallEnded(event: RetellWebhookEvent, context: CallContext) {
  if (!context.callTaskId) {
    return null;
  }

  const disposition = getOutboundDisposition(event);
  const { data: task } = await supabaseAdmin
    .from("call_tasks")
    .select("campaign_id, status, attempts, campaigns(status, max_attempts_per_task, retry_delay_minutes, max_concurrent)")
    .eq("id", context.callTaskId)
    .eq("tenant_id", context.tenantId)
    .single<{
      campaign_id: string;
      status: string;
      attempts: number;
      campaigns: {
        status: string;
        max_attempts_per_task: number;
        retry_delay_minutes: number;
        max_concurrent: number;
      } | null;
    }>();

  const dispatchContext =
    task?.campaigns?.status === "running"
      ? {
          campaignId: task.campaign_id,
          limit: Math.max(task.campaigns.max_concurrent, 1),
        }
      : null;

  if (task?.status === "cancelled") {
    return { disposition: "skipped_by_user", dispatchContext };
  }

  const campaign = task?.campaigns;
  const attempts = task?.attempts ?? 0;
  const maxAttempts = campaign?.max_attempts_per_task ?? 1;
  const retryDelayMinutes = campaign?.retry_delay_minutes ?? 60;
  const shouldRetryNoAnswer = disposition === "no_answer" && attempts < maxAttempts;
  const nextAttemptAt = shouldRetryNoAnswer
    ? new Date(Date.now() + retryDelayMinutes * 60_000).toISOString()
    : null;
  const status =
    disposition === "answered_completed" ||
    disposition === "agent_completed" ||
    disposition === "voicemail_left"
      ? "completed"
      : shouldRetryNoAnswer
        ? "scheduled"
        : disposition === "no_answer"
          ? "no_answer"
          : disposition === "busy"
            ? "busy"
            : disposition === "voicemail_or_quick_hangup"
              ? "voicemail"
              : "failed";

  await supabaseAdmin
    .from("call_tasks")
    .update({
      status,
      disposition,
      next_attempt_at: nextAttemptAt,
      updated_at: new Date().toISOString(),
    })
    .eq("id", context.callTaskId)
    .eq("tenant_id", context.tenantId);

  return { disposition, dispatchContext };
}

async function handleCallEnded(event: RetellWebhookEvent, context: CallContext) {
  const outboundUpdate = context.isOutbound
    ? await updateOutboundTaskOnCallEnded(event, context)
    : null;
  const disposition = outboundUpdate?.disposition ?? null;
  const callerPhone = getStoredCallerPhone(event, context);
  const { data, error } = await supabaseAdmin
    .from("intake_calls")
    .upsert(
      {
        tenant_id: context.tenantId,
        retell_call_id: event.call.call_id,
        caller_phone: callerPhone,
        caller_phone_normalized: callerPhone ? normalizePhone(callerPhone) : null,
        call_ended_at: parseTimestamp(event.call.end_timestamp),
        duration_seconds: getDurationSeconds(event),
        transcript: event.call.transcript ?? null,
        disconnect_reason: getDisconnectReason(event),
        call_direction: context.isOutbound ? "outbound" : "inbound",
        campaign_id: context.campaignId,
        call_task_id: context.callTaskId,
      },
      {
        onConflict: "retell_call_id",
      }
    )
    .select("id")
    .single<IntakeCallRow>();

  if (error || !data) {
    throw new Error("Failed to update ended call");
  }

  await insertCallEvent({
    tenantId: context.tenantId,
    callId: data.id,
    event: event.event,
    retellCallId: event.call.call_id,
    callTaskId: context.callTaskId,
    disposition,
  });

  if (outboundUpdate?.dispatchContext) {
    await dispatchCampaignCalls(
      context.tenantId,
      outboundUpdate.dispatchContext.campaignId,
      outboundUpdate.dispatchContext.limit
    );
  }
}

async function handleCallAnalyzed(
  event: RetellWebhookEvent,
  context: CallContext,
  origin: string
) {
  const callerPhone = getStoredCallerPhone(event, context);
  const { data, error } = await supabaseAdmin
    .from("intake_calls")
    .upsert(
      {
        tenant_id: context.tenantId,
        retell_call_id: event.call.call_id,
        caller_phone: callerPhone,
        caller_phone_normalized: callerPhone ? normalizePhone(callerPhone) : null,
        transcript: event.call.transcript ?? null,
        recording_url: event.call.recording_url ?? null,
        call_direction: context.isOutbound ? "outbound" : "inbound",
        campaign_id: context.campaignId,
        call_task_id: context.callTaskId,
      },
      {
        onConflict: "retell_call_id",
      }
    )
    .select("id, lead_id, call_task_id")
    .single<IntakeCallRow>();

  if (error || !data) {
    throw new Error("Failed to update analyzed call");
  }

  const internalSecret = process.env.INTERNAL_API_SECRET;
  const { data: task } =
    context.isOutbound && context.callTaskId
      ? await supabaseAdmin
          .from("call_tasks")
          .select("lead_id, merge_fields")
          .eq("id", context.callTaskId)
          .eq("tenant_id", context.tenantId)
          .single<{ lead_id: string | null; merge_fields: Record<string, unknown> | null }>()
      : { data: null };
  const isTestCall =
    task?.merge_fields?.test_call === "true" || task?.merge_fields?.mode === "test_outbound";
  const shouldEnqueueExtraction =
    Boolean(event.call.transcript) &&
    !isTestCall &&
    (!context.isOutbound || Boolean(data.lead_id ?? task?.lead_id));

  if (!shouldEnqueueExtraction) {
    // No transcript or outbound lead context to reconcile yet.
  } else if (!internalSecret) {
    console.error("Retell extraction enqueue failed", {
      event: event.event,
      call_id: event.call.call_id,
      call_task_id: context.callTaskId,
      disposition: null,
    });
  } else {
    void fetch(`${origin}/api/retell/extract`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-internal-secret": internalSecret,
      },
      body: JSON.stringify({
        call_id: data.id,
      }),
    }).catch(() => {
      console.error("Retell extraction enqueue failed", {
        event: event.event,
        call_id: event.call.call_id,
        call_task_id: context.callTaskId,
        disposition: null,
      });
    });
  }

  await insertCallEvent({
    tenantId: context.tenantId,
    callId: data.id,
    event: event.event,
    retellCallId: event.call.call_id,
    callTaskId: context.callTaskId,
  });
}

export async function POST(request: Request) {
  let safeLogFields = {
    event: "unknown",
    call_id: "unknown",
    call_task_id: null as string | null,
    disposition: null as string | null,
  };

  try {
    const rawBody = await request.text();

    if (!verifySignature(rawBody, request.headers.get("x-retell-signature"))) {
      return new Response(null, {
        status: 401,
      });
    }

    const parsedJson: unknown = JSON.parse(rawBody);
    safeLogFields = getSafeLogFields(parsedJson);

    const parsed = retellWebhookSchema.safeParse(parsedJson);

    if (!parsed.success) {
      return Response.json(
        {
          error: "invalid",
        },
        {
          status: 400,
        }
      );
    }

    const context = getCallContext(parsed.data);

    switch (parsed.data.event) {
      case "call_started":
        await handleCallStarted(parsed.data, context);
        break;
      case "call_ended":
        await handleCallEnded(parsed.data, context);
        break;
      case "call_analyzed":
        await handleCallAnalyzed(parsed.data, context, new URL(request.url).origin);
        break;
    }

    return Response.json({
      ok: true,
    });
  } catch {
    console.error("Retell webhook error", safeLogFields);

    return Response.json(
      {
        error: "internal",
      },
      {
        status: 500,
      }
    );
  }
}
