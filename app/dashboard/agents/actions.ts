"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { AgentTemplateRow, ImportTemplateResult } from "@/app/dashboard/agents/types";
import { getCurrentUser } from "@/lib/auth";
import {
  deleteAgent,
  exportAgent,
  importAgent,
  RetellApiError,
  updateAgent,
  validateRetellPayload,
} from "@/lib/retell/client";
import type { RetellAgentImportPayload } from "@/lib/retell/client";
import { createClient } from "@/lib/supabase/server";

const importTemplateSchema = z.object({
  template_id: z.uuid(),
  overrides: z.object({
    agent_name: z.string().trim().optional(),
    voice_id: z.string().trim().optional(),
    language: z.string().trim().optional(),
    webhook_base_url: z.string().trim().optional(),
    variables: z.record(z.string(), z.string()),
  }),
});

const templateSchema = z.object({
  id: z.uuid(),
  tenant_id: z.uuid().nullable(),
  name: z.string(),
  required_variables: z.array(z.string()).nullable(),
  retell_payload: z.unknown(),
  imported_agent_ids: z.array(z.string()).nullable(),
});

const templateCategorySchema = z.enum(["inbound", "outbound", "test", "specialty"]);
const templatePurposeSchema = z.enum([
  "client_intake",
  "caregiver_recruitment",
  "reengagement",
  "eligibility_followup",
  "appointment_reminder",
  "satisfaction_survey",
  "general",
  "test",
]);

const validateUploadedTemplateSchema = z.object({
  json_text: z.string().min(1),
});

const saveUploadedTemplateSchema = z.object({
  metadata: z.object({
    name: z.string().trim().min(1),
    description: z.string().trim().optional(),
    category: templateCategorySchema,
    purpose: templatePurposeSchema.optional(),
    tags: z.array(z.string()),
  }),
  payload: z.unknown(),
  required_variables: z.array(z.string()),
  default_variables: z.record(z.string(), z.string()),
});

const templateIdSchema = z.object({
  template_id: z.uuid(),
});

const deleteTemplateSchema = z.object({
  template_id: z.uuid(),
  delete_retell_agents: z.boolean().default(false),
});

const updateTemplateSchema = z.object({
  template_id: z.uuid(),
  metadata: z.object({
    name: z.string().trim().min(1),
    description: z.string().trim().optional(),
    category: templateCategorySchema,
    purpose: templatePurposeSchema.optional().nullable(),
    tags: z.array(z.string()),
    required_variables: z.array(z.string()),
    default_variables: z.record(z.string(), z.string()),
  }),
  retell_payload: z.unknown(),
});

const reimportTemplateSchema = z.object({
  template_id: z.uuid(),
});

const saveRetellAgentAsTemplateSchema = z.object({
  retell_agent_id: z.string().trim().min(1),
  metadata: z
    .object({
      name: z.string().trim().optional(),
      description: z.string().trim().optional(),
      category: templateCategorySchema.optional(),
      purpose: templatePurposeSchema.optional(),
      tags: z.array(z.string()).optional(),
    })
    .optional(),
  required_variables: z.array(z.string()).optional(),
});

const cloneFromRetellAgentIdSchema = z.object({
  agent_id: z.string().trim().min(1),
});

const templateRowSchema = z.object({
  id: z.uuid(),
  tenant_id: z.uuid().nullable(),
  name: z.string(),
  slug: z.string(),
  description: z.string().nullable(),
  category: z.string(),
  purpose: z.string().nullable(),
  tags: z.array(z.string()).nullable(),
  version: z.number(),
  retell_payload: z.unknown(),
  default_voice: z.string().nullable(),
  default_llm_model: z.string().nullable(),
  required_variables: z.array(z.string()).nullable(),
  default_variables: z.record(z.string(), z.unknown()).nullable(),
  imported_agent_ids: z.array(z.string()).nullable(),
  is_system: z.boolean(),
  created_at: z.string().nullable(),
  updated_at: z.string().nullable(),
});

class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ValidationError";
  }
}

class ImportError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ImportError";
  }
}

function cloneJson<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function sanitizeError(error: unknown) {
  if (error instanceof RetellApiError) {
    return `Retell API request failed with status ${error.status}.`;
  }

  if (error instanceof Error) {
    return error.message.slice(0, 300);
  }

  return "Agent import failed.";
}

function assertHttpsWebhookBaseUrl(value: string) {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new ValidationError("Webhook base URL is invalid.");
  }

  if (url.protocol !== "https:") {
    throw new ValidationError("Webhook base URL must use https://.");
  }

  if (
    process.env.NODE_ENV === "production" &&
    ["localhost", "127.0.0.1"].includes(url.hostname)
  ) {
    throw new ValidationError("Localhost webhook URLs are not allowed in production.");
  }

  return url.origin;
}

async function getFallbackWebhookBaseUrl() {
  if (process.env.NEXT_PUBLIC_APP_URL) {
    return process.env.NEXT_PUBLIC_APP_URL;
  }

  const requestHeaders = await headers();
  const host = requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host");
  const proto = requestHeaders.get("x-forwarded-proto") ?? "https";

  if (!host) {
    throw new ValidationError("Webhook base URL is required.");
  }

  return `${proto}://${host}`;
}

function substitutePlaceholders(value: unknown, variables: Record<string, string>): unknown {
  if (typeof value === "string") {
    return value.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (match, key: string) => {
      return key in variables ? variables[key] : match;
    });
  }

  if (Array.isArray(value)) {
    return value.map((item) => substitutePlaceholders(item, variables));
  }

  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [
        key,
        substitutePlaceholders(item, variables),
      ])
    );
  }

  return value;
}

function collectStrings(value: unknown): string[] {
  if (typeof value === "string") {
    return [value];
  }

  if (Array.isArray(value)) {
    return value.flatMap(collectStrings);
  }

  if (value && typeof value === "object") {
    return Object.values(value).flatMap(collectStrings);
  }

  return [];
}

function collectUrls(value: unknown, parentKey = ""): Array<{ url: string; key: string }> {
  if (typeof value === "string" && /^https?:\/\//i.test(value)) {
    return [{ url: value, key: parentKey }];
  }

  if (Array.isArray(value)) {
    return value.flatMap((item) => collectUrls(item, parentKey));
  }

  if (value && typeof value === "object") {
    return Object.entries(value).flatMap(([key, item]) => collectUrls(item, key));
  }

  return [];
}

function collectPlaceholders(value: unknown): string[] {
  const matches = collectStrings(value).flatMap((text) => {
    return Array.from(text.matchAll(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g)).map(
      (match) => match[1]
    );
  });

  return Array.from(new Set(matches)).sort();
}

function getRetellPrompt(payload: RetellAgentImportPayload) {
  return payload.retell_llm?.general_prompt ?? payload.response_engine.prompt ?? "";
}

function getRetellTools(payload: RetellAgentImportPayload) {
  return payload.retell_llm?.general_tools ?? [];
}

function getUploadedTemplateIssues(payload: RetellAgentImportPayload) {
  const issues: string[] = [];
  const prompt = getRetellPrompt(payload);
  const tools = getRetellTools(payload);

  if (prompt.length > 50_000) {
    issues.push("general_prompt exceeds the 50,000 character limit.");
  }

  if (tools.length > 30) {
    issues.push("general_tools exceeds the 30 tool limit.");
  }

  for (const item of collectUrls(payload)) {
    let url: URL;
    try {
      url = new URL(item.url);
    } catch {
      issues.push(`Invalid URL found in ${item.key || "payload"}.`);
      continue;
    }

    const isLocalhost = ["localhost", "127.0.0.1"].includes(url.hostname);
    const isWebhookOrToolUrl = item.key === "webhook_url" || item.key === "url";

    if (isWebhookOrToolUrl && url.protocol !== "https:" && !isLocalhost) {
      issues.push(`Retell webhook/tool URL must be https: ${item.url}`);
    }

    if (isWebhookOrToolUrl && isLocalhost && process.env.NODE_ENV === "production") {
      issues.push(`Localhost webhook/tool URL is not allowed in production: ${item.url}`);
    }
  }

  return issues;
}

function getUploadedTemplateWarnings(payload: RetellAgentImportPayload) {
  return collectUrls(payload)
    .filter((item) => {
      return !item.url.includes("{{webhook_base_url}}");
    })
    .map((item) => `External absolute URL found in ${item.key || "payload"}: ${item.url}`);
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

async function auditTemplateEvent(
  eventType: string,
  templateId: string | null,
  extra: Record<string, unknown> = {}
) {
  const supabase = await createClient();
  const { profile } = await getCurrentUser();
  await supabase.from("call_events").insert({
    tenant_id: profile.tenant_id,
    call_id: null,
    lead_id: null,
    event_type: eventType,
    payload: {
      template_id: templateId,
      action: eventType,
      ...extra,
    },
    created_by: profile.id,
  });
}

async function loadVisibleTemplate(templateId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("agent_templates")
    .select(
      "id, tenant_id, name, slug, description, category, purpose, tags, version, retell_payload, default_voice, default_llm_model, required_variables, default_variables, imported_agent_ids, is_system, created_at, updated_at"
    )
    .eq("id", templateId)
    .single();

  if (error || !data) {
    throw new ValidationError("Template not found or not available to this tenant.");
  }

  return templateRowSchema.parse(data) as AgentTemplateRow;
}

async function loadTenantTemplate(templateId: string) {
  const template = await loadVisibleTemplate(templateId);
  const { profile } = await getCurrentUser();

  if (template.tenant_id !== profile.tenant_id || template.is_system) {
    throw new ValidationError("Only agency-owned templates can be changed.");
  }

  return template;
}

async function updateImportAudit(
  importId: string,
  values: Record<string, unknown>
) {
  const supabase = await createClient();
  await supabase.from("agent_template_imports").update(values).eq("id", importId);
}

async function appendTenantOwnedImportedAgentId(
  templateId: string,
  existingAgentIds: string[],
  agentId: string
) {
  const supabase = await createClient();
  await supabase
    .from("agent_templates")
    .update({
      imported_agent_ids: Array.from(new Set([...existingAgentIds, agentId])),
    })
    .eq("id", templateId);
}

export async function importTemplateToRetell(
  input: unknown
): Promise<ImportTemplateResult> {
  const parsed = importTemplateSchema.safeParse(input);
  if (!parsed.success) {
    throw new ValidationError("Invalid template import request.");
  }

  const supabase = await createClient();
  const { profile } = await getCurrentUser();
  const { data, error } = await supabase
    .from("agent_templates")
    .select("id, tenant_id, name, required_variables, retell_payload, imported_agent_ids")
    .eq("id", parsed.data.template_id)
    .single();

  if (error || !data) {
    throw new ValidationError("Template not found or not available to this tenant.");
  }

  const template = templateSchema.parse(data);
  const requiredVariables = template.required_variables ?? [];
  const variables = parsed.data.overrides.variables;
  const missingVariables = requiredVariables.filter((variable) => {
    return !variables[variable]?.trim();
  });

  if (missingVariables.length) {
    throw new ValidationError(`Missing required variables: ${missingVariables.join(", ")}`);
  }

  const webhookBaseUrl = assertHttpsWebhookBaseUrl(
    parsed.data.overrides.webhook_base_url || (await getFallbackWebhookBaseUrl())
  );
  const payloadVariables = {
    ...variables,
    webhook_base_url: webhookBaseUrl,
  };
  const payloadDraft = substitutePlaceholders(
    cloneJson(template.retell_payload),
    payloadVariables
  ) as Record<string, unknown>;

  if (parsed.data.overrides.agent_name) {
    payloadDraft.agent_name = parsed.data.overrides.agent_name;
  }
  if (parsed.data.overrides.voice_id) {
    payloadDraft.voice_id = parsed.data.overrides.voice_id;
  }
  if (parsed.data.overrides.language) {
    payloadDraft.language = parsed.data.overrides.language;
  }

  const payload = validateRetellPayload(payloadDraft) as RetellAgentImportPayload;
  const { data: audit, error: auditError } = await supabase
    .from("agent_template_imports")
    .insert({
      tenant_id: profile.tenant_id,
      template_id: template.id,
      imported_by: profile.id,
      status: "pending",
    })
    .select("id")
    .single<{ id: string }>();

  if (auditError || !audit) {
    throw new ImportError("Unable to create import audit row.");
  }

  await auditTemplateEvent("agent_template_import_started", template.id);

  try {
    const result = await importAgent(payload);

    await updateImportAudit(audit.id, {
      status: "success",
      retell_agent_id: result.agent_id,
      retell_response: {
        agent_id: result.agent_id,
        llm_id: result.llm_id,
        conversation_flow_id: result.conversation_flow_id,
        variables,
      },
    });

    if (template.tenant_id === profile.tenant_id) {
      await appendTenantOwnedImportedAgentId(
        template.id,
        template.imported_agent_ids ?? [],
        result.agent_id
      );
    }

    await auditTemplateEvent("agent_template_imported", template.id, {
      retell_agent_id: result.agent_id,
    });
    revalidatePath("/dashboard/agents");
    return {
      agent_id: result.agent_id,
      llm_id: result.llm_id,
      conversation_flow_id: result.conversation_flow_id,
      variables,
    };
  } catch (error) {
    const message = sanitizeError(error);
    await updateImportAudit(audit.id, {
      status: "failed",
      error_message: message,
    });
    await auditTemplateEvent("agent_template_import_failed", template.id);
    throw new ImportError(message);
  }
}

export async function validateUploadedTemplate(input: unknown): Promise<{
  valid: boolean;
  payload: RetellAgentImportPayload | null;
  detected_variables: string[];
  issues: string[];
}> {
  const parsed = validateUploadedTemplateSchema.safeParse(input);
  if (!parsed.success) {
    return {
      valid: false,
      payload: null,
      detected_variables: [],
      issues: ["JSON text is required."],
    };
  }

  try {
    const rawPayload = JSON.parse(parsed.data.json_text) as unknown;
    const payload = validateRetellPayload(rawPayload);
    const issues = getUploadedTemplateIssues(payload);
    const warnings = getUploadedTemplateWarnings(payload);

    return {
      valid: issues.length === 0,
      payload,
      detected_variables: collectPlaceholders(payload),
      issues: [...issues, ...warnings],
    };
  } catch (error) {
    return {
      valid: false,
      payload: null,
      detected_variables: [],
      issues: [
        error instanceof Error
          ? error.message.slice(0, 300)
          : "Uploaded template JSON is malformed.",
      ],
    };
  }
}

export async function saveUploadedTemplate(input: unknown): Promise<{
  template_id: string;
  template: AgentTemplateRow;
}> {
  const parsed = saveUploadedTemplateSchema.safeParse(input);
  if (!parsed.success) {
    throw new ValidationError("Invalid uploaded template metadata.");
  }

  const payload = validateRetellPayload(parsed.data.payload);
  const issues = getUploadedTemplateIssues(payload);
  if (issues.length) {
    throw new ValidationError(issues.join(" "));
  }

  const supabase = await createClient();
  const { profile } = await getCurrentUser();
  const slugBase = slugify(parsed.data.metadata.name) || "uploaded-agent-template";
  const slug = `${slugBase}-${Date.now().toString(36)}`;
  const { data, error } = await supabase
    .from("agent_templates")
    .insert({
      tenant_id: profile.tenant_id,
      name: parsed.data.metadata.name,
      slug,
      description: parsed.data.metadata.description || null,
      category: parsed.data.metadata.category,
      purpose: parsed.data.metadata.purpose ?? null,
      tags: parsed.data.metadata.tags,
      version: 1,
      retell_payload: payload,
      default_voice: payload.voice_id,
      default_llm_model: payload.retell_llm?.model ?? null,
      required_variables: parsed.data.required_variables,
      default_variables: parsed.data.default_variables,
      imported_agent_ids: [],
      is_system: false,
      created_by: profile.id,
    })
    .select(
      "id, tenant_id, name, slug, description, category, purpose, tags, version, retell_payload, default_voice, default_llm_model, required_variables, default_variables, imported_agent_ids, is_system, created_at, updated_at"
    )
    .single();

  if (error || !data) {
    throw new ImportError("Unable to save uploaded template.");
  }

  await auditTemplateEvent("agent_template_json_imported", data.id);
  revalidatePath("/dashboard/agents");
  return {
    template_id: data.id,
    template: data as AgentTemplateRow,
  };
}

export async function exportTemplate(input: unknown): Promise<{
  payload: RetellAgentImportPayload;
}> {
  const parsed = templateIdSchema.safeParse(input);
  if (!parsed.success) {
    throw new ValidationError("Invalid template export request.");
  }

  const template = await loadVisibleTemplate(parsed.data.template_id);
  const payload = validateRetellPayload(template.retell_payload);
  await auditTemplateEvent("agent_template_exported", template.id);
  return { payload };
}

export async function duplicateTemplate(input: unknown): Promise<{ template_id: string }> {
  const parsed = templateIdSchema.safeParse(input);
  if (!parsed.success) {
    throw new ValidationError("Invalid template duplicate request.");
  }

  const supabase = await createClient();
  const { profile } = await getCurrentUser();
  const original = await loadVisibleTemplate(parsed.data.template_id);
  const timestamp = Date.now().toString(36);
  const { data, error } = await supabase
    .from("agent_templates")
    .insert({
      tenant_id: profile.tenant_id,
      name: `${original.name} Copy`,
      slug: `${original.slug}-copy-${timestamp}`,
      description: original.description,
      category: original.category,
      purpose: original.purpose,
      tags: original.tags ?? [],
      version: 1,
      retell_payload: original.retell_payload,
      default_voice: original.default_voice,
      default_llm_model: original.default_llm_model,
      required_variables: original.required_variables ?? [],
      default_variables: original.default_variables ?? {},
      imported_agent_ids: [],
      is_system: false,
      created_by: profile.id,
    })
    .select("id")
    .single<{ id: string }>();

  if (error || !data) {
    throw new ImportError("Unable to duplicate template.");
  }

  await auditTemplateEvent("agent_template_duplicated", data.id, {
    source_template_id: original.id,
  });
  revalidatePath("/dashboard/agents");
  return { template_id: data.id };
}

export async function updateTemplate(input: unknown): Promise<{ template_id: string }> {
  const parsed = updateTemplateSchema.safeParse(input);
  if (!parsed.success) {
    throw new ValidationError("Invalid template update request.");
  }

  const payload = validateRetellPayload(parsed.data.retell_payload);
  const template = await loadTenantTemplate(parsed.data.template_id);
  const supabase = await createClient();
  const { error } = await supabase
    .from("agent_templates")
    .update({
      name: parsed.data.metadata.name,
      description: parsed.data.metadata.description || null,
      category: parsed.data.metadata.category,
      purpose: parsed.data.metadata.purpose || null,
      tags: parsed.data.metadata.tags,
      required_variables: parsed.data.metadata.required_variables,
      default_variables: parsed.data.metadata.default_variables,
      retell_payload: payload,
      default_voice: payload.voice_id,
      default_llm_model: payload.retell_llm?.model ?? null,
      version: template.version + 1,
    })
    .eq("id", template.id);

  if (error) {
    throw new ImportError("Unable to update template.");
  }

  await auditTemplateEvent("agent_template_updated", template.id);
  revalidatePath("/dashboard/agents");
  revalidatePath(`/dashboard/agents/${template.id}/edit`);
  return { template_id: template.id };
}

export async function updateImportedRetellAgents(input: unknown): Promise<{
  updated_agent_ids: string[];
}> {
  const parsed = reimportTemplateSchema.safeParse(input);
  if (!parsed.success) {
    throw new ValidationError("Invalid Retell update request.");
  }

  const template = await loadTenantTemplate(parsed.data.template_id);
  const payload = validateRetellPayload(template.retell_payload);
  const agentIds = template.imported_agent_ids ?? [];
  const updatedAgentIds: string[] = [];

  for (const agentId of agentIds) {
    await updateAgent(agentId, payload);
    updatedAgentIds.push(agentId);
  }

  await auditTemplateEvent("agent_template_reimported", template.id, {
    retell_agent_count: updatedAgentIds.length,
  });
  return { updated_agent_ids: updatedAgentIds };
}

export async function deleteTemplate(input: unknown): Promise<{ deleted: true }> {
  const parsed = deleteTemplateSchema.safeParse(input);
  if (!parsed.success) {
    throw new ValidationError("Invalid template delete request.");
  }

  const template = await loadTenantTemplate(parsed.data.template_id);
  const agentIds = template.imported_agent_ids ?? [];

  if (parsed.data.delete_retell_agents) {
    for (const agentId of agentIds) {
      await deleteAgent(agentId);
    }
  }

  await auditTemplateEvent("agent_template_deleted", template.id, {
    deleted_retell_agent_count: parsed.data.delete_retell_agents ? agentIds.length : 0,
  });

  const supabase = await createClient();
  const { error } = await supabase.from("agent_templates").delete().eq("id", template.id);

  if (error) {
    throw new ImportError("Unable to delete template.");
  }

  revalidatePath("/dashboard/agents");
  return { deleted: true };
}

export async function saveRetellAgentAsTemplate(input: unknown): Promise<{
  payload: RetellAgentImportPayload;
  suggested_variables: string[];
  issues: string[];
  metadata: {
    name: string;
    description: string;
    category: "inbound" | "outbound" | "test" | "specialty";
    purpose:
      | "client_intake"
      | "caregiver_recruitment"
      | "reengagement"
      | "eligibility_followup"
      | "appointment_reminder"
      | "satisfaction_survey"
      | "general"
      | "test";
    tags: string[];
  };
}> {
  const parsed = saveRetellAgentAsTemplateSchema.safeParse(input);
  if (!parsed.success) {
    throw new ValidationError("Invalid Retell agent export request.");
  }

  const payload = await exportAgent(parsed.data.retell_agent_id);
  const strings = collectStrings(payload).join("\n");
  const suggestedVariables = new Set<string>(parsed.data.required_variables ?? []);

  if (/\b\d{3}[-.\s]?\d{3}[-.\s]?\d{4}\b/.test(strings)) {
    suggestedVariables.add("agency_phone_number");
  }
  if (/https?:\/\//i.test(strings)) {
    suggestedVariables.add("webhook_base_url");
  }
  if (payload.agent_name && !payload.agent_name.includes("{{")) {
    suggestedVariables.add("agency_name");
  }

  await auditTemplateEvent("agent_template_retell_agent_exported", null, {
    retell_agent_id: parsed.data.retell_agent_id,
  });

  return {
    payload,
    suggested_variables: Array.from(suggestedVariables).sort(),
    issues: getUploadedTemplateWarnings(payload),
    metadata: {
      name: parsed.data.metadata?.name || payload.agent_name || "Retell Agent Template",
      description: parsed.data.metadata?.description || "",
      category: parsed.data.metadata?.category || "inbound",
      purpose: parsed.data.metadata?.purpose || "general",
      tags: parsed.data.metadata?.tags || ["retell", "exported"],
    },
  };
}

export async function cloneFromRetellAgentId(input: unknown): Promise<{
  payload: RetellAgentImportPayload;
  suggested_variables: string[];
  issues: string[];
  metadata: {
    name: string;
    description: string;
    category: "inbound" | "outbound" | "test" | "specialty";
    purpose:
      | "client_intake"
      | "caregiver_recruitment"
      | "reengagement"
      | "eligibility_followup"
      | "appointment_reminder"
      | "satisfaction_survey"
      | "general"
      | "test";
    tags: string[];
  };
}> {
  const parsed = cloneFromRetellAgentIdSchema.safeParse(input);
  if (!parsed.success) {
    throw new ValidationError("Enter a Retell agent ID.");
  }

  return saveRetellAgentAsTemplate({
    retell_agent_id: parsed.data.agent_id,
    metadata: {
      tags: ["retell", "cloned"],
    },
  });
}
