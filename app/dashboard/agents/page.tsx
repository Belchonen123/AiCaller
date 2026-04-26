import { z } from "zod";
import { headers } from "next/headers";
import { AgentsClient } from "@/app/dashboard/agents/agents-client";
import type {
  AgentTemplateRow,
  RetellAgentSummary,
  RetellVoiceSummary,
} from "@/app/dashboard/agents/types";
import { PageHeader } from "@/components/page-header";
import { getCurrentUser } from "@/lib/auth";
import { listAgents, listVoices } from "@/lib/retell/client";
import { createClient } from "@/lib/supabase/server";

const templateSchema = z.object({
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

const retellAgentSchema = z
  .object({
    agent_id: z.string(),
    agent_name: z.string().nullable().optional(),
    voice_id: z.string().nullable().optional(),
  })
  .passthrough();

const retellVoiceSchema = z
  .object({
    voice_id: z.string(),
    voice_name: z.string().nullable().optional(),
    provider: z.string().nullable().optional(),
    preview_audio_url: z.string().nullable().optional(),
  })
  .passthrough();

async function loadTemplates(tenantId: string) {
  const supabase = await createClient();
  const [systemResult, tenantResult] = await Promise.all([
    supabase
      .from("agent_templates")
      .select(
        "id, tenant_id, name, slug, description, category, purpose, tags, version, retell_payload, default_voice, default_llm_model, required_variables, default_variables, imported_agent_ids, is_system, created_at, updated_at"
      )
      .eq("is_system", true)
      .order("name"),
    supabase
      .from("agent_templates")
      .select(
        "id, tenant_id, name, slug, description, category, purpose, tags, version, retell_payload, default_voice, default_llm_model, required_variables, default_variables, imported_agent_ids, is_system, created_at, updated_at"
      )
      .eq("tenant_id", tenantId)
      .order("updated_at", { ascending: false }),
  ]);

  if (systemResult.error) {
    throw new Error("Unable to load system agent templates");
  }

  if (tenantResult.error) {
    throw new Error("Unable to load agency agent templates");
  }

  return {
    systemTemplates: z.array(templateSchema).parse(systemResult.data ?? []),
    tenantTemplates: z.array(templateSchema).parse(tenantResult.data ?? []),
  };
}

async function loadRetellAgents(): Promise<RetellAgentSummary[]> {
  if (!process.env.RETELL_API_KEY) {
    return [];
  }

  try {
    const agents = await listAgents();
    return z.array(retellAgentSchema).parse(agents);
  } catch {
    return [];
  }
}

async function loadRetellVoices(): Promise<RetellVoiceSummary[]> {
  if (!process.env.RETELL_API_KEY) {
    return [];
  }

  try {
    const voices = await listVoices();
    return z.array(retellVoiceSchema).parse(voices);
  } catch {
    return [];
  }
}

async function getWebhookBaseUrl() {
  if (process.env.NEXT_PUBLIC_APP_URL) {
    return process.env.NEXT_PUBLIC_APP_URL.replace(/\/$/, "");
  }

  const requestHeaders = await headers();
  const host = requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host");
  const proto = requestHeaders.get("x-forwarded-proto") ?? "https";

  return host ? `${proto}://${host}` : "";
}

export default async function AgentsPage() {
  const currentUser = await getCurrentUser();
  const [{ systemTemplates, tenantTemplates }, retellAgents, retellVoices, webhookBaseUrl] =
    await Promise.all([
    loadTemplates(currentUser.profile.tenant_id),
    loadRetellAgents(),
    loadRetellVoices(),
    getWebhookBaseUrl(),
  ]);

  return (
    <div className="grid gap-4">
      <PageHeader
        eyebrow="Configuration"
        title="Agents"
        description="Manage system agent templates, agency templates, and Retell imports."
      />
      <AgentsClient
        systemTemplates={systemTemplates as AgentTemplateRow[]}
        tenantTemplates={tenantTemplates as AgentTemplateRow[]}
        retellAgents={retellAgents}
        retellVoices={retellVoices}
        tenantName={currentUser.tenant.name}
        webhookBaseUrl={webhookBaseUrl}
      />
    </div>
  );
}
