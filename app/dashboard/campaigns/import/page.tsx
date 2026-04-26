import { z } from "zod";
import { ImportCallingListWizard } from "@/app/dashboard/campaigns/import/import-calling-list-wizard";
import { PageHeader } from "@/components/page-header";
import { getCurrentUser } from "@/lib/auth";
import { listAgents, listPhoneNumbers } from "@/lib/retell/client";
import { supabaseAdmin } from "@/lib/supabase/admin";

const templateSchema = z.object({
  id: z.string(),
  name: z.string(),
  required_variables: z.array(z.string()).nullable(),
  default_variables: z.record(z.string(), z.unknown()).nullable(),
});

type TemplateImportRow = {
  template_id: string;
  retell_agent_id: string | null;
};

async function loadTemplateVariables(tenantId: string) {
  const [templatesResult, importsResult] = await Promise.all([
    supabaseAdmin
      .from("agent_templates")
      .select("id, name, required_variables, default_variables")
      .or(`is_system.eq.true,tenant_id.eq.${tenantId}`)
      .returns<unknown[]>(),
    supabaseAdmin
      .from("agent_template_imports")
      .select("template_id, retell_agent_id")
      .eq("tenant_id", tenantId)
      .eq("status", "success")
      .not("retell_agent_id", "is", null)
      .returns<TemplateImportRow[]>(),
  ]);
  const templates = z.array(templateSchema).parse(templatesResult.data ?? []);
  const templatesById = new Map(templates.map((template) => [template.id, template]));

  return (importsResult.data ?? []).flatMap((importRow) => {
    const template = templatesById.get(importRow.template_id);
    if (!template || !importRow.retell_agent_id) {
      return [];
    }

    return {
      agent_id: importRow.retell_agent_id,
      template_name: template.name,
      required_variables: template.required_variables ?? [],
      default_variables: template.default_variables ?? {},
    };
  });
}

export default async function ImportCallingListPage() {
  const current = await getCurrentUser();
  const [agentsResult, phoneNumbersResult, templateVariables] = await Promise.allSettled([
    listAgents(),
    listPhoneNumbers(),
    loadTemplateVariables(current.profile.tenant_id),
  ]);

  return (
    <div className="grid gap-5">
      <PageHeader
        eyebrow="Campaigns"
        title="Import calling list"
        description="Start with a CSV, then build the campaign around the list."
      />
      <ImportCallingListWizard
        agents={agentsResult.status === "fulfilled" ? agentsResult.value : []}
        phoneNumbers={phoneNumbersResult.status === "fulfilled" ? phoneNumbersResult.value : []}
        templateVariables={
          templateVariables.status === "fulfilled" ? templateVariables.value : []
        }
      />
    </div>
  );
}
