"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { dispatchCampaignCalls } from "@/lib/retell/dispatcher";
import { getCurrentUser } from "@/lib/auth";
import { maskPhone, normalizePhone } from "@/lib/phone";
import { parseCallListCsv } from "@/lib/campaigns/parse-csv";
import { deleteCall, exportAgent, RetellApiError } from "@/lib/retell/client";
import { buildSettingsDynamicVariables } from "@/lib/retell/dynamic-variables";
import { supabaseAdmin } from "@/lib/supabase/admin";

export type CampaignActionResult = {
  ok: boolean;
  message: string;
  campaign_id?: string;
  launched?: number;
  failed?: number;
};

const purposeSchema = z.enum([
  "reengagement",
  "followup",
  "referral_followup",
  "caregiver_recruitment",
  "eligibility_check",
  "general_outreach",
  "test",
]);

const statusSchema = z.enum(["draft", "ready", "running", "paused", "completed", "cancelled"]);

const createCampaignSchema = z.object({
  name: z.string().trim().min(1),
  purpose: purposeSchema,
  description: z.string().trim().optional(),
  agent_id: z.string().trim().min(1),
  from_phone: z.string().trim().min(1),
  script_variables: z.string().trim().default("{}"),
  max_concurrent: z.coerce.number().int().positive().max(25).default(1),
  max_attempts_per_task: z.coerce.number().int().positive().max(10).default(3),
  retry_delay_minutes: z.coerce.number().int().positive().max(1440).default(60),
  call_window_start: z.string().trim().default("09:00:00"),
  call_window_end: z.string().trim().default("20:00:00"),
  call_window_timezone: z.string().trim().min(1).default("America/Detroit"),
});

const selfTestSchema = z.object({
  phone: z.string().trim().min(1),
  agent_id: z.string().trim().min(1),
  from_phone: z.string().trim().min(1),
});

const updateCampaignConfigSchema = createCampaignSchema.extend({
  campaign_id: z.string().uuid(),
  script_variables: z.string().trim().default("{}"),
});

const addSingleTaskSchema = z.object({
  campaign_id: z.string().uuid(),
  phone: z.string().trim().min(1),
  contact_name: z.string().trim().optional(),
  merge_fields: z.string().trim().default("{}"),
});

const taskActionSchema = z.object({
  campaign_id: z.string().uuid(),
  task_id: z.string().uuid(),
});

const csvCampaignSchema = z.object({
  campaign_id: z.string().uuid(),
  file_text: z.string().max(2 * 1024 * 1024),
  phone_column: z.string().trim().optional(),
  name_column: z.string().trim().optional(),
  filename: z.string().trim().optional(),
});

const csvImportValidationSchema = csvCampaignSchema.omit({ campaign_id: true, filename: true });

const csvVariableMappingSchema = z.record(
  z.string().trim().min(1),
  z.discriminatedUnion("mode", [
    z.object({ mode: z.literal("fixed"), value: z.string() }),
    z.object({ mode: z.literal("column"), column: z.string().trim().min(1) }),
    z.object({ mode: z.literal("default") }),
  ])
);

const importCallingListSchema = createCampaignSchema.extend({
  file_text: z.string().max(2 * 1024 * 1024),
  phone_column: z.string().trim().optional(),
  name_column: z.string().trim().optional(),
  filename: z.string().trim().optional(),
  status: z.enum(["draft", "running"]),
  variable_mapping: csvVariableMappingSchema.default({}),
});

export type CsvValidationResult = {
  ok: boolean;
  message: string;
  headers: string[];
  accepted_count: number;
  rejected_count: number;
  warnings: string[];
  rejected_rows: Array<{
    row_number: number;
    reason: string;
  }>;
  accepted_samples: Array<{
    row_number: number;
    masked_phone: string;
    merge_fields: Record<string, string>;
  }>;
};

export type ImportCallingListResult = CampaignActionResult & {
  accepted?: number;
  rejected?: number;
  launched?: number;
  failed?: number;
};

async function requireAdmin() {
  const current = await getCurrentUser();
  if (!["owner", "admin"].includes(current.profile.role)) {
    throw new Error("Forbidden");
  }
  return current;
}

function actionError(message: string): CampaignActionResult {
  return { ok: false, message };
}

function parseJsonRecord(value: string) {
  try {
    const parsed = JSON.parse(value || "{}");
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}

function applyCsvVariableMapping(
  mergeFields: Record<string, string>,
  raw: Record<string, string>,
  mappings: z.infer<typeof csvVariableMappingSchema>
) {
  const next = { ...mergeFields };

  for (const [variable, mapping] of Object.entries(mappings)) {
    if (mapping.mode === "fixed") {
      next[variable] = mapping.value;
    }

    if (mapping.mode === "column") {
      next[variable] = raw[mapping.column] ?? "";
    }
  }

  return next;
}

async function loadTenantCampaign(campaignId: string, tenantId: string) {
  const { data, error } = await supabaseAdmin
    .from("campaigns")
    .select("id, status, agent_id, from_phone, max_attempts_per_task, max_concurrent")
    .eq("tenant_id", tenantId)
    .eq("id", campaignId)
    .single<{
      id: string;
      status: string;
      agent_id: string | null;
      from_phone: string | null;
      max_attempts_per_task: number;
      max_concurrent: number;
    }>();

  if (error || !data) {
    return null;
  }

  return data;
}

export async function createCampaign(input: unknown): Promise<CampaignActionResult> {
  const parsed = createCampaignSchema.safeParse(input);
  if (!parsed.success) {
    return actionError("Enter the required campaign details.");
  }

  const current = await requireAdmin();
  const scriptVariables = parseJsonRecord(parsed.data.script_variables);
  if (!scriptVariables) {
    return actionError("Script variables must be a JSON object.");
  }

  const { error } = await supabaseAdmin.from("campaigns").insert({
    tenant_id: current.profile.tenant_id,
    name: parsed.data.name,
    purpose: parsed.data.purpose,
    description: parsed.data.description || null,
    agent_id: parsed.data.agent_id,
    from_phone: parsed.data.from_phone,
    script_variables: scriptVariables,
    max_concurrent: parsed.data.max_concurrent,
    max_attempts_per_task: parsed.data.max_attempts_per_task,
    retry_delay_minutes: parsed.data.retry_delay_minutes,
    call_window_start: parsed.data.call_window_start,
    call_window_end: parsed.data.call_window_end,
    call_window_timezone: parsed.data.call_window_timezone,
    status: "draft",
    created_by: current.profile.id,
  });

  if (error) {
    return actionError("Unable to create campaign.");
  }

  revalidatePath("/dashboard/campaigns");
  return { ok: true, message: "Campaign saved as draft." };
}

export async function createCampaignDraft(input: unknown): Promise<CampaignActionResult> {
  const parsed = createCampaignSchema.safeParse(input);
  if (!parsed.success) {
    return actionError("Enter the required campaign details.");
  }

  const current = await requireAdmin();
  const scriptVariables = parseJsonRecord(parsed.data.script_variables);
  if (!scriptVariables) {
    return actionError("Script variables must be a JSON object.");
  }

  const { data, error } = await supabaseAdmin
    .from("campaigns")
    .insert({
      tenant_id: current.profile.tenant_id,
      name: parsed.data.name,
      purpose: parsed.data.purpose,
      description: parsed.data.description || null,
      agent_id: parsed.data.agent_id,
      from_phone: parsed.data.from_phone,
      script_variables: scriptVariables,
      max_concurrent: parsed.data.max_concurrent,
      max_attempts_per_task: parsed.data.max_attempts_per_task,
      retry_delay_minutes: parsed.data.retry_delay_minutes,
      call_window_start: parsed.data.call_window_start,
      call_window_end: parsed.data.call_window_end,
      call_window_timezone: parsed.data.call_window_timezone,
      status: "draft",
      created_by: current.profile.id,
    })
    .select("id")
    .single<{ id: string }>();

  if (error || !data) {
    return actionError("Unable to create campaign.");
  }

  revalidatePath("/dashboard/campaigns");
  return { ok: true, message: "Campaign saved as draft.", campaign_id: data.id };
}

export async function validateImportCsv(input: unknown): Promise<CsvValidationResult> {
  const parsed = csvImportValidationSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      message: "Upload a valid CSV file under 2MB.",
      headers: [],
      accepted_count: 0,
      rejected_count: 0,
      warnings: [],
      rejected_rows: [],
      accepted_samples: [],
    };
  }

  await requireAdmin();
  const result = await parseCallListCsv(parsed.data.file_text, {
    phone_column: parsed.data.phone_column || undefined,
    name_column: parsed.data.name_column || undefined,
  });

  return {
    ok: true,
    message: "CSV parsed.",
    headers: result.headers,
    accepted_count: result.accepted_count,
    rejected_count: result.rejected_count,
    warnings: result.warnings,
    rejected_rows: result.rows
      .filter((row) => row.errors.length > 0)
      .slice(0, 20)
      .map((row) => ({
        row_number: row.row_number,
        reason: row.errors.join(", "),
      })),
    accepted_samples: result.rows
      .filter((row) => row.errors.length === 0 && row.to_phone)
      .slice(0, 5)
      .map((row) => ({
        row_number: row.row_number,
        masked_phone: maskPhone(row.to_phone ?? ""),
        merge_fields: row.merge_fields,
      })),
  };
}

export async function importCallingListCampaign(
  input: unknown
): Promise<ImportCallingListResult> {
  const parsed = importCallingListSchema.safeParse(input);
  if (!parsed.success) {
    return actionError("Enter the required campaign and CSV details.");
  }

  const current = await requireAdmin();
  const baseScriptVariables = parseJsonRecord(parsed.data.script_variables);
  if (!baseScriptVariables) {
    return actionError("Script variables must be a JSON object.");
  }

  const csv = await parseCallListCsv(parsed.data.file_text, {
    phone_column: parsed.data.phone_column || undefined,
    name_column: parsed.data.name_column || undefined,
  });
  const acceptedRows = csv.rows.filter((row) => row.errors.length === 0 && row.to_phone);
  const rejectedRows = csv.rows
    .filter((row) => row.errors.length > 0)
    .map((row) => ({
      row_number: row.row_number,
      raw_row: row.raw,
      reason: row.errors.join(", "),
    }));

  if (acceptedRows.length === 0) {
    return actionError("No valid phone numbers were found in this CSV.");
  }

  const scriptVariables = {
    ...baseScriptVariables,
    __csv_variable_mapping: parsed.data.variable_mapping,
  };
  const { data: campaign, error: campaignError } = await supabaseAdmin
    .from("campaigns")
    .insert({
      tenant_id: current.profile.tenant_id,
      name: parsed.data.name,
      purpose: parsed.data.purpose,
      description: parsed.data.description || null,
      agent_id: parsed.data.agent_id,
      from_phone: parsed.data.from_phone,
      script_variables: scriptVariables,
      max_concurrent: parsed.data.max_concurrent,
      max_attempts_per_task: parsed.data.max_attempts_per_task,
      retry_delay_minutes: parsed.data.retry_delay_minutes,
      call_window_start: parsed.data.call_window_start,
      call_window_end: parsed.data.call_window_end,
      call_window_timezone: parsed.data.call_window_timezone,
      status: parsed.data.status,
      created_by: current.profile.id,
      started_at: parsed.data.status === "running" ? new Date().toISOString() : null,
    })
    .select("id")
    .single<{ id: string }>();

  if (campaignError || !campaign) {
    return actionError("Unable to create campaign.");
  }

  const { data: batch, error: batchError } = await supabaseAdmin
    .from("call_upload_batches")
    .insert({
      tenant_id: current.profile.tenant_id,
      campaign_id: campaign.id,
      uploaded_by: current.profile.id,
      filename: parsed.data.filename || null,
    })
    .select("id")
    .single<{ id: string }>();

  if (batchError || !batch) {
    return actionError("Unable to create upload batch.");
  }

  const { error: insertError } = await supabaseAdmin.from("call_tasks").insert(
    acceptedRows.map((row) => ({
      tenant_id: current.profile.tenant_id,
      campaign_id: campaign.id,
      to_phone: row.to_phone,
      to_phone_raw: row.to_phone_raw,
      contact_name: row.contact_name,
      merge_fields: applyCsvVariableMapping(row.merge_fields, row.raw, parsed.data.variable_mapping),
      status: "queued",
    }))
  );

  if (insertError) {
    return actionError("Unable to insert call tasks.");
  }

  await supabaseAdmin
    .from("call_upload_batches")
    .update({
      row_count_total: csv.rows.length,
      row_count_accepted: acceptedRows.length,
      row_count_rejected: rejectedRows.length,
      rejected_rows: rejectedRows,
    })
    .eq("tenant_id", current.profile.tenant_id)
    .eq("id", batch.id);

  const dispatchResult =
    parsed.data.status === "running"
      ? await dispatchCampaignCalls(current.profile.tenant_id, campaign.id, parsed.data.max_concurrent)
      : { launched: 0, failed: 0 };

  revalidatePath("/dashboard/campaigns");
  revalidatePath(`/dashboard/campaigns/${campaign.id}`);
  return {
    ok: true,
    message:
      parsed.data.status === "running"
        ? `Campaign created and started. Launched ${dispatchResult.launched} calls.`
        : "Campaign saved as draft.",
    campaign_id: campaign.id,
    accepted: acceptedRows.length,
    rejected: rejectedRows.length,
    launched: dispatchResult.launched,
    failed: dispatchResult.failed,
  };
}

export async function updateCampaignStatus(input: unknown): Promise<CampaignActionResult> {
  const parsed = z
    .object({
      campaign_id: z.string().uuid(),
      status: statusSchema,
    })
    .safeParse(input);

  if (!parsed.success) {
    return actionError("Invalid campaign status.");
  }

  const current = await requireAdmin();
  const campaign = await loadTenantCampaign(parsed.data.campaign_id, current.profile.tenant_id);
  if (!campaign) {
    return actionError("Campaign not found.");
  }

  const nextStatus = parsed.data.status;
  const allowedTransitions: Record<string, string[]> = {
    draft: ["ready", "cancelled"],
    ready: ["running", "cancelled"],
    running: ["paused", "completed"],
    paused: ["running", "cancelled"],
    completed: ["paused"],
    cancelled: [],
  };

  if (!allowedTransitions[campaign.status]?.includes(nextStatus)) {
    return actionError("That campaign status change is not allowed.");
  }

  if (campaign.status === "draft" && nextStatus === "ready") {
    if (!campaign.agent_id || !campaign.from_phone) {
      return actionError("Add a Retell agent and from number before marking ready.");
    }

    const { count, error: countError } = await supabaseAdmin
      .from("call_tasks")
      .select("id", { count: "exact", head: true })
      .eq("tenant_id", current.profile.tenant_id)
      .eq("campaign_id", campaign.id);

    if (countError || !count) {
      return actionError("Add at least one task before marking ready.");
    }
  }

  const patch: Record<string, string | null> = {
    status: nextStatus,
  };

  if (nextStatus === "running") {
    patch.started_at = new Date().toISOString();
  }

  if (nextStatus === "completed") {
    patch.completed_at = new Date().toISOString();
  }

  if (campaign.status === "completed" && nextStatus === "paused") {
    patch.completed_at = null;
  }

  const { error } = await supabaseAdmin
    .from("campaigns")
    .update(patch)
    .eq("tenant_id", current.profile.tenant_id)
    .eq("id", parsed.data.campaign_id);

  if (error) {
    return actionError("Unable to update campaign.");
  }

  const dispatchResult =
    nextStatus === "running"
      ? await dispatchCampaignCalls(
          current.profile.tenant_id,
          campaign.id,
          Math.max(campaign.max_concurrent, 1)
        )
      : { launched: 0, failed: 0 };

  revalidatePath("/dashboard/campaigns");
  revalidatePath(`/dashboard/campaigns/${campaign.id}`);
  return {
    ok: true,
    message:
      campaign.status === "completed" && nextStatus === "paused"
        ? "Campaign reopened. You can add more tasks now."
        : nextStatus === "running"
          ? `Campaign running. Launched ${dispatchResult.launched} calls.`
        : `Campaign ${nextStatus}.`,
    launched: dispatchResult.launched,
    failed: dispatchResult.failed,
  };
}

export async function placeSelfTestCall(input: unknown): Promise<CampaignActionResult> {
  const parsed = selfTestSchema.safeParse(input);
  if (!parsed.success) {
    return actionError("Enter a phone number, agent, and from number.");
  }

  const current = await requireAdmin();
  const toPhone = normalizePhone(parsed.data.phone);
  if (!toPhone) {
    return actionError("Enter a valid phone number.");
  }

  const { data: campaign, error: campaignError } = await supabaseAdmin
    .from("campaigns")
    .insert({
      tenant_id: current.profile.tenant_id,
      name: "Self-test",
      purpose: "test",
      agent_id: parsed.data.agent_id,
      from_phone: parsed.data.from_phone,
      status: "ready",
      max_concurrent: 1,
      max_attempts_per_task: 1,
      retry_delay_minutes: 60,
      created_by: current.profile.id,
    })
    .select("id")
    .single<{ id: string }>();

  if (campaignError || !campaign) {
    return actionError("Unable to create self-test campaign.");
  }

  const { error: taskError } = await supabaseAdmin.from("call_tasks").insert({
    tenant_id: current.profile.tenant_id,
    campaign_id: campaign.id,
    to_phone: toPhone,
    to_phone_raw: parsed.data.phone,
    contact_name: current.profile.full_name || "Self-test",
    status: "queued",
    merge_fields: {
      contact_name: current.profile.full_name || "Self-test",
      test_call: "true",
    },
  });

  if (taskError) {
    return actionError("Unable to create self-test task.");
  }

  await supabaseAdmin
    .from("campaigns")
    .update({ status: "running", started_at: new Date().toISOString() })
    .eq("tenant_id", current.profile.tenant_id)
    .eq("id", campaign.id);

  const result = await dispatchCampaignCalls(current.profile.tenant_id, campaign.id, 1);
  revalidatePath("/dashboard/campaigns");

  if (result.launched > 0) {
    return {
      ok: true,
      message:
        "Calling you now - the AI will ring your phone within a few seconds. Check the Calls page to see the transcript after the call ends.",
    };
  }

  return actionError("Self-test campaign was created, but no call launched yet.");
}

export async function addSingleCallTask(input: unknown): Promise<CampaignActionResult> {
  const parsed = addSingleTaskSchema.safeParse(input);
  if (!parsed.success) {
    return actionError("Enter a valid phone number.");
  }

  const current = await requireAdmin();
  const campaign = await loadTenantCampaign(parsed.data.campaign_id, current.profile.tenant_id);
  if (!campaign || !["draft", "ready", "paused"].includes(campaign.status)) {
    return actionError("Tasks can only be added while a campaign is draft, ready, or paused.");
  }

  const toPhone = normalizePhone(parsed.data.phone);
  if (!toPhone) {
    return actionError("Enter a valid phone number.");
  }

  const mergeFields = parseJsonRecord(parsed.data.merge_fields);
  if (!mergeFields) {
    return actionError("Merge fields must be a JSON object.");
  }

  const { error } = await supabaseAdmin.from("call_tasks").insert({
    tenant_id: current.profile.tenant_id,
    campaign_id: campaign.id,
    to_phone: toPhone,
    to_phone_raw: parsed.data.phone,
    contact_name: parsed.data.contact_name || null,
    merge_fields: mergeFields,
    status: "queued",
  });

  if (error) {
    return actionError("Unable to add task.");
  }

  revalidatePath(`/dashboard/campaigns/${campaign.id}`);
  return { ok: true, message: "Task added." };
}

export async function retryCallTaskNow(input: unknown): Promise<CampaignActionResult> {
  const parsed = taskActionSchema.safeParse(input);
  if (!parsed.success) {
    return actionError("Invalid task.");
  }

  const current = await requireAdmin();
  const campaign = await loadTenantCampaign(parsed.data.campaign_id, current.profile.tenant_id);
  if (!campaign || ["completed", "cancelled"].includes(campaign.status)) {
    return actionError("This campaign cannot retry tasks.");
  }

  const { error } = await supabaseAdmin
    .from("call_tasks")
    .update({ status: "queued", next_attempt_at: null, updated_at: new Date().toISOString() })
    .eq("tenant_id", current.profile.tenant_id)
    .eq("campaign_id", campaign.id)
    .eq("id", parsed.data.task_id)
    .in("status", ["failed", "no_answer"]);

  if (error) {
    return actionError("Unable to retry task.");
  }

  revalidatePath(`/dashboard/campaigns/${campaign.id}`);
  return { ok: true, message: "Task queued for retry." };
}

export async function skipCallTask(input: unknown): Promise<CampaignActionResult> {
  const parsed = taskActionSchema.safeParse(input);
  if (!parsed.success) {
    return actionError("Invalid task.");
  }

  const current = await requireAdmin();
  const campaign = await loadTenantCampaign(parsed.data.campaign_id, current.profile.tenant_id);
  if (!campaign || ["completed", "cancelled"].includes(campaign.status)) {
    return actionError("This campaign cannot skip tasks.");
  }

  const { data: task, error: taskError } = await supabaseAdmin
    .from("call_tasks")
    .select("id, status, last_retell_call_id")
    .eq("tenant_id", current.profile.tenant_id)
    .eq("campaign_id", campaign.id)
    .eq("id", parsed.data.task_id)
    .single<{
      id: string;
      status: string;
      last_retell_call_id: string | null;
    }>();

  if (taskError || !task) {
    return actionError("Task not found.");
  }

  const skippedActiveCall = task.status === "in_progress";

  if (skippedActiveCall && task.last_retell_call_id) {
    try {
      await deleteCall(task.last_retell_call_id);
    } catch (error) {
      if (!(error instanceof RetellApiError && error.status === 404)) {
        return actionError("Unable to end the active Retell call. Try again in a moment.");
      }
    }
  }

  const { error } = await supabaseAdmin
    .from("call_tasks")
    .update({
      status: "cancelled",
      disposition: skippedActiveCall ? "skipped_by_user" : "cancelled_by_user",
      next_attempt_at: null,
      updated_at: new Date().toISOString(),
    })
    .eq("tenant_id", current.profile.tenant_id)
    .eq("campaign_id", campaign.id)
    .eq("id", parsed.data.task_id);

  if (error) {
    return actionError("Unable to skip task.");
  }

  revalidatePath(`/dashboard/campaigns/${campaign.id}`);
  if (campaign.status === "running") {
    const counts = await dispatchCampaignCalls(
      current.profile.tenant_id,
      campaign.id,
      Math.max(campaign.max_concurrent, 1)
    );
    return {
      ok: true,
      message:
        counts.launched > 0
          ? skippedActiveCall
            ? "Task skipped. Retell ended the active call and started the next one."
            : "Task skipped. Started the next call."
          : skippedActiveCall
            ? "Task skipped. Retell ended the active call; no next call was ready."
            : "Task skipped. No next call was ready.",
    };
  }

  return { ok: true, message: "Task skipped." };
}

export async function updateCampaignConfig(input: unknown): Promise<CampaignActionResult> {
  const parsed = updateCampaignConfigSchema.safeParse(input);
  if (!parsed.success) {
    return actionError("Enter valid campaign configuration.");
  }

  const current = await requireAdmin();
  const campaign = await loadTenantCampaign(parsed.data.campaign_id, current.profile.tenant_id);
  if (!campaign || campaign.status === "running") {
    return actionError("Campaign configuration cannot be edited while running.");
  }

  const scriptVariables = parseJsonRecord(parsed.data.script_variables);
  if (!scriptVariables) {
    return actionError("Script variables must be a JSON object.");
  }

  const { error } = await supabaseAdmin
    .from("campaigns")
    .update({
      name: parsed.data.name,
      purpose: parsed.data.purpose,
      description: parsed.data.description || null,
      agent_id: parsed.data.agent_id,
      from_phone: parsed.data.from_phone,
      max_concurrent: parsed.data.max_concurrent,
      max_attempts_per_task: parsed.data.max_attempts_per_task,
      retry_delay_minutes: parsed.data.retry_delay_minutes,
      call_window_start: parsed.data.call_window_start,
      call_window_end: parsed.data.call_window_end,
      call_window_timezone: parsed.data.call_window_timezone,
      script_variables: scriptVariables,
    })
    .eq("tenant_id", current.profile.tenant_id)
    .eq("id", campaign.id);

  if (error) {
    return actionError("Unable to save campaign configuration.");
  }

  revalidatePath("/dashboard/campaigns");
  revalidatePath(`/dashboard/campaigns/${campaign.id}`);
  return { ok: true, message: "Campaign configuration saved." };
}

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

export async function parseAndValidateCsv(input: unknown): Promise<CsvValidationResult> {
  const parsed = csvCampaignSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      message: "Upload a valid CSV file under 2MB.",
      headers: [],
      accepted_count: 0,
      rejected_count: 0,
      warnings: [],
      rejected_rows: [],
      accepted_samples: [],
    };
  }

  const current = await requireAdmin();
  const campaign = await loadTenantCampaign(parsed.data.campaign_id, current.profile.tenant_id);
  if (!campaign) {
    return {
      ok: false,
      message: "Campaign not found.",
      headers: [],
      accepted_count: 0,
      rejected_count: 0,
      warnings: [],
      rejected_rows: [],
      accepted_samples: [],
    };
  }

  const result = await parseCallListCsv(parsed.data.file_text, {
    phone_column: parsed.data.phone_column || undefined,
    name_column: parsed.data.name_column || undefined,
  });

  return {
    ok: true,
    message: "CSV parsed.",
    headers: result.headers,
    accepted_count: result.accepted_count,
    rejected_count: result.rejected_count,
    warnings: result.warnings,
    rejected_rows: result.rows
      .filter((row) => row.errors.length > 0)
      .slice(0, 20)
      .map((row) => ({
        row_number: row.row_number,
        reason: row.errors.join(", "),
      })),
    accepted_samples: result.rows
      .filter((row) => row.errors.length === 0 && row.to_phone)
      .slice(0, 5)
      .map((row) => ({
        row_number: row.row_number,
        masked_phone: maskPhone(row.to_phone ?? ""),
        merge_fields: row.merge_fields,
      })),
  };
}

export async function uploadCsvToCampaign(input: unknown): Promise<{
  ok: boolean;
  message: string;
  batch_id?: string;
  accepted?: number;
  rejected?: number;
}> {
  const parsed = csvCampaignSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, message: "Upload a valid CSV file under 2MB." };
  }

  const current = await requireAdmin();
  const campaign = await loadTenantCampaign(parsed.data.campaign_id, current.profile.tenant_id);
  if (!campaign || !["draft", "ready", "paused"].includes(campaign.status)) {
    return {
      ok: false,
      message: "CSV tasks can only be uploaded while a campaign is draft, ready, or paused.",
    };
  }

  const result = await parseCallListCsv(parsed.data.file_text, {
    phone_column: parsed.data.phone_column || undefined,
    name_column: parsed.data.name_column || undefined,
  });
  const acceptedRows = result.rows.filter((row) => row.errors.length === 0 && row.to_phone);
  const rejectedRows = result.rows
    .filter((row) => row.errors.length > 0)
    .map((row) => ({
      row_number: row.row_number,
      raw_row: row.raw,
      reason: row.errors.join(", "),
    }));

  const { data: batch, error: batchError } = await supabaseAdmin
    .from("call_upload_batches")
    .insert({
      tenant_id: current.profile.tenant_id,
      campaign_id: campaign.id,
      uploaded_by: current.profile.id,
      filename: parsed.data.filename || null,
    })
    .select("id")
    .single<{ id: string }>();

  if (batchError || !batch) {
    return { ok: false, message: "Unable to create upload batch." };
  }

  if (acceptedRows.length > 0) {
    const { error: insertError } = await supabaseAdmin.from("call_tasks").insert(
      acceptedRows.map((row) => ({
        tenant_id: current.profile.tenant_id,
        campaign_id: campaign.id,
        to_phone: row.to_phone,
        to_phone_raw: row.to_phone_raw,
        contact_name: row.contact_name,
        merge_fields: row.merge_fields,
        status: "queued",
      }))
    );

    if (insertError) {
      return { ok: false, message: "Unable to insert call tasks." };
    }
  }

  await supabaseAdmin
    .from("call_upload_batches")
    .update({
      row_count_total: result.rows.length,
      row_count_accepted: acceptedRows.length,
      row_count_rejected: rejectedRows.length,
      rejected_rows: rejectedRows,
    })
    .eq("tenant_id", current.profile.tenant_id)
    .eq("id", batch.id);

  revalidatePath(`/dashboard/campaigns/${campaign.id}`);
  return {
    ok: true,
    message: `Uploaded ${acceptedRows.length} tasks. They'll start calling when the campaign runs.`,
    batch_id: batch.id,
    accepted: acceptedRows.length,
    rejected: rejectedRows.length,
  };
}
