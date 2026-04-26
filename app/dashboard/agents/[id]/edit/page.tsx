import { notFound } from "next/navigation";
import { z } from "zod";
import { EditTemplateForm } from "@/app/dashboard/agents/[id]/edit/edit-template-form";
import type { AgentTemplateRow } from "@/app/dashboard/agents/types";
import { getCurrentUser } from "@/lib/auth";
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

type EditTemplatePageProps = {
  params: Promise<{
    id: string;
  }>;
};

export default async function EditTemplatePage({ params }: EditTemplatePageProps) {
  const [{ id }, currentUser, supabase] = await Promise.all([
    params,
    getCurrentUser(),
    createClient(),
  ]);
  const { data, error } = await supabase
    .from("agent_templates")
    .select(
      "id, tenant_id, name, slug, description, category, purpose, tags, version, retell_payload, default_voice, default_llm_model, required_variables, default_variables, imported_agent_ids, is_system, created_at, updated_at"
    )
    .eq("id", id)
    .eq("tenant_id", currentUser.profile.tenant_id)
    .eq("is_system", false)
    .single();

  if (error || !data) {
    notFound();
  }

  const template = templateSchema.parse(data) as AgentTemplateRow;

  return (
    <div className="grid gap-4">
      <div>
        <h1 className="text-xl font-semibold">Edit agent template</h1>
        <p className="text-sm text-muted-foreground">
          Update metadata and Retell import JSON for this agency-owned template.
        </p>
      </div>
      <EditTemplateForm template={template} />
    </div>
  );
}
