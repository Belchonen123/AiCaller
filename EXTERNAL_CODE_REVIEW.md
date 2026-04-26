# External Code Review Bundle

Generated for review of the Retell dynamic-variable and test-call/call-detail fixes.

No environment variables, API keys, phone numbers, or `.env` contents are included.

## Scope

This review bundle covers:

- Pulling Retell dynamic variables from agency settings.
- Preserving override order for template, campaign, and task variables.
- Keeping test calls polling until transcript/extraction artifacts are ready.
- Fixing call detail lookup by using explicit Supabase relationship joins and server-side lookup.

## Files Touched

- `lib/retell/dynamic-variables.ts`
- `lib/retell/dispatcher.ts`
- `app/dashboard/campaigns/actions.ts`
- `app/api/test-call/status/route.ts`
- `app/dashboard/test-call/test-call-client.tsx`
- `app/dashboard/calls/query.ts`

## 1. Shared Retell Dynamic Variables

File: `lib/retell/dynamic-variables.ts`

```ts
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
```

## 2. Dispatcher Integration

File: `lib/retell/dispatcher.ts`

Relevant imports and types:

```ts
import {
  buildSettingsDynamicVariables,
  mergeRetellDynamicVariables,
} from "@/lib/retell/dynamic-variables";
import { createPhoneCall, RetellApiError } from "@/lib/retell/client";
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

type TenantRow = {
  name: string;
  agency_phone: string | null;
  agency_address: string | null;
};
```

Campaign and tenant loading:

```ts
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
```

Retell call creation:

```ts
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
    task.merge_fields
  ),
});
```

Review note: merge order is intentional. Agency settings are defaults. Template/import variables can override settings. Campaign script variables override those. Per-task merge fields win last.

## 3. Campaign Prompt Preview Consistency

File: `app/dashboard/campaigns/actions.ts`

```ts
import { buildSettingsDynamicVariables } from "@/lib/retell/dynamic-variables";
```

```ts
export async function previewAgentPrompt(input: unknown): Promise<{
  ok: boolean;
  message: string;
  prompt?: string;
}> {
  const parsed = z
    .object({
      agent_id: z.string().trim().min(1),
      script_variables: z.string().trim().default("{}"),
      sample_merge_fields: z.string().trim().default("{}"),
    })
    .safeParse(input);

  if (!parsed.success) {
    return { ok: false, message: "Select an agent first." };
  }

  const current = await requireAdmin();
  const scriptVariables = parseJsonRecord(parsed.data.script_variables);
  const mergeFields = parseJsonRecord(parsed.data.sample_merge_fields);
  if (!scriptVariables || !mergeFields) {
    return { ok: false, message: "Variables must be JSON objects." };
  }

  try {
    const agent = await exportAgent(parsed.data.agent_id);
    const prompt =
      agent.retell_llm?.general_prompt ??
      agent.response_engine.prompt ??
      "No prompt found for this agent.";
    const variables = {
      ...buildSettingsDynamicVariables({ tenant: current.tenant }),
      ...scriptVariables,
      ...mergeFields,
    };
    const renderedPrompt = prompt.replace(/\{\{\s*([\w.-]+)\s*\}\}/g, (match, key) =>
      variables[key] === undefined ? match : String(variables[key])
    );

    return { ok: true, message: "Prompt loaded.", prompt: renderedPrompt };
  } catch {
    return { ok: false, message: "Unable to load prompt from Retell." };
  }
}
```

Review note: preview now mirrors dispatch defaults, except it does not derive `call_purpose` from a specific campaign because the preview action currently receives only `agent_id`, `script_variables`, and `sample_merge_fields`.

## 4. Test Call Status Sync

File: `app/api/test-call/status/route.ts`

```ts
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

    return task.status === "completed" && (!call.transcript || !call.extraction);
  });
```

```ts
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
```

Review note: this closes the race where Retell marks a task completed before transcript/extraction has been inserted or re-synced locally.

## 5. Test Call Client Polling

File: `app/dashboard/test-call/test-call-client.tsx`

```tsx
const activeStatuses = new Set(["queued", "scheduled", "in_progress"]);
const terminalStatuses = new Set(["completed", "failed", "cancelled", "voicemail", "no_answer", "busy"]);
```

```tsx
const isWaitingForArtifacts =
  task?.status === "completed" && (!task.call_href || !task.transcript || !task.has_extraction);
const isActive = currentTaskId
  ? task
    ? activeStatuses.has(task.status) ||
      isWaitingForArtifacts
    : true
  : false;
const isComplete = Boolean(task && terminalStatuses.has(task.status) && !isWaitingForArtifacts);
```

```tsx
const statusText =
  task?.status === "in_progress"
    ? `Conversation in progress (${formatDuration(elapsedSeconds)})`
    : task?.status === "completed"
      ? "Call ended - preparing transcript and extraction"
      : task?.status === "queued" || task?.status === "scheduled"
        ? "Dialing your number..."
        : task?.status
          ? `Status: ${task.status}`
          : "Dialing your number...";
```

Review note: the UI does not show final “Call complete” until the transcript and extraction have arrived for completed calls.

## 6. Call Detail Lookup

File: `app/dashboard/calls/query.ts`

```ts
import { z } from "zod";
import {
  callEventSchema,
  callRowSchema,
  relatedLeadSchema,
  type CallFilters,
} from "@/app/dashboard/calls/types";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
```

Calls list relationship pin:

```ts
let query = supabase
  .from("intake_calls")
  .select("*, leads!intake_calls_lead_tenant_fk(id, lead_type, lead_status)")
  .eq("tenant_id", params.tenantId)
  .gte("created_at", fromIso)
  .lte("created_at", toIso)
  .order("created_at", { ascending: false })
  .limit(100);
```

Call detail lookup:

```ts
export async function loadCallDetail(params: {
  tenantId: string;
  callId: string;
}) {
  const [callResult, eventsResult, leadsResult] = await Promise.all([
    supabaseAdmin
      .from("intake_calls")
      .select("*, leads!intake_calls_lead_tenant_fk(id, lead_type, lead_status)")
      .eq("tenant_id", params.tenantId)
      .eq("id", params.callId)
      .single(),
    supabaseAdmin
      .from("call_events")
      .select("id, event_type, payload, created_at, profiles!call_events_created_by_tenant_fk(full_name, email)")
      .eq("tenant_id", params.tenantId)
      .eq("call_id", params.callId)
      .order("created_at", { ascending: false }),
    supabaseAdmin
      .from("leads")
      .select("id, lead_type, lead_status, created_at")
      .eq("tenant_id", params.tenantId)
      .order("created_at", { ascending: false })
      .limit(100),
  ]);

  if (callResult.error || !callResult.data) {
    return null;
  }

  return {
    call: callRowSchema.parse(callResult.data),
    events: z.array(callEventSchema).parse(eventsResult.data ?? []),
    relatedLeads: z.array(relatedLeadSchema).parse(leadsResult.data ?? []),
  };
}
```

Review note: `intake_calls` and `call_events` have tenant-safe foreign keys that should be referenced explicitly. This avoids ambiguous Supabase relationship embeds and prevents valid call IDs from falling through to the dashboard Not Found page.

## Verification Performed

```text
pnpm lint
```

Result: passed in both the main workspace copy and the temporary live app copy used by `localhost:3008`.
