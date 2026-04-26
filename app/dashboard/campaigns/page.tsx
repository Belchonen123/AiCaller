import Link from "next/link";
import { headers } from "next/headers";
import type { ComponentType } from "react";
import { z } from "zod";
import {
  ArrowRightIcon,
  CheckCircle2Icon,
  ClockIcon,
  Loader2Icon,
  UploadCloudIcon,
  XCircleIcon,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/page-header";
import { getCurrentUser } from "@/lib/auth";
import { getRetellConnectionStatus } from "@/lib/retell/connection-state";
import { listAgents, listPhoneNumbers, listVoices } from "@/lib/retell/client";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { cn } from "@/lib/utils";
import { RetellConnectionGuide } from "@/app/dashboard/retell-connection-guide";
import { ImportCallListDialog } from "@/app/dashboard/campaigns/import-call-list-dialog";
import {
  CampaignStatusActions,
  NewCampaignDialog,
  SelfTestCard,
  type TemplateAgentOption,
} from "@/app/dashboard/campaigns/campaign-controls";
import type { AgentTemplateRow } from "@/app/dashboard/agents/types";

type CampaignRow = {
  id: string;
  name: string;
  purpose: string;
  status: string;
  created_at: string | null;
  profiles?: {
    full_name: string | null;
    email: string | null;
  } | null;
};

type TaskRow = {
  campaign_id: string;
  status: string;
};

type TemplateImportRow = {
  template_id: string;
  retell_agent_id: string | null;
  retell_response: Record<string, unknown> | null;
};

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

const statusVariants: Record<string, "neutral" | "info" | "success" | "warning" | "danger"> = {
  draft: "neutral",
  ready: "info",
  running: "success",
  paused: "warning",
  completed: "neutral",
  cancelled: "danger",
};

function formatDate(value: string | null) {
  if (!value) {
    return "";
  }

  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(value));
}

function taskCounts(tasks: TaskRow[], campaignId: string) {
  const campaignTasks = tasks.filter((task) => task.campaign_id === campaignId);

  return {
    total: campaignTasks.length,
    queued: campaignTasks.filter((task) => task.status === "queued").length,
    inProgress: campaignTasks.filter((task) => task.status === "in_progress").length,
    completed: campaignTasks.filter((task) => task.status === "completed").length,
    failed: campaignTasks.filter((task) => task.status === "failed").length,
  };
}

function createdBy(campaign: CampaignRow) {
  return campaign.profiles?.full_name || campaign.profiles?.email || "Unknown";
}

async function loadRetellOptions() {
  const [agentsResult, phoneNumbersResult, voicesResult] = await Promise.allSettled([
    listAgents(),
    listPhoneNumbers(),
    listVoices(),
  ]);
  const agents = agentsResult.status === "fulfilled" ? agentsResult.value : [];
  const phoneNumbers =
    phoneNumbersResult.status === "fulfilled" ? phoneNumbersResult.value : [];
  const connection = getRetellConnectionStatus({
    agents,
    phoneNumbers,
    agentsLoadFailed: agentsResult.status === "rejected",
    phoneNumbersLoadFailed: phoneNumbersResult.status === "rejected",
  });

  return {
    agents,
    phoneNumbers,
    voices: voicesResult.status === "fulfilled" ? voicesResult.value : [],
    connectionState: connection.connectionState,
    issues: connection.issues,
  };
}

function recordFromUnknown(value: unknown): Record<string, string> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }

  return Object.fromEntries(
    Object.entries(value).map(([key, item]) => [key, String(item ?? "")])
  );
}

async function loadAgentTemplates(tenantId: string) {
  const [templatesResult, importsResult] = await Promise.all([
    supabaseAdmin
      .from("agent_templates")
      .select(
        "id, tenant_id, name, slug, description, category, purpose, tags, version, retell_payload, default_voice, default_llm_model, required_variables, default_variables, imported_agent_ids, is_system, created_at, updated_at"
      )
      .or(`is_system.eq.true,tenant_id.eq.${tenantId}`)
      .order("name"),
    supabaseAdmin
      .from("agent_template_imports")
      .select("template_id, retell_agent_id, retell_response")
      .eq("tenant_id", tenantId)
      .eq("status", "success")
      .not("retell_agent_id", "is", null)
      .order("created_at", { ascending: false })
      .returns<TemplateImportRow[]>(),
  ]);
  const templates = z.array(templateSchema).parse(templatesResult.data ?? []) as AgentTemplateRow[];
  const templatesById = new Map(templates.map((template) => [template.id, template]));
  const templateAgents: TemplateAgentOption[] = (importsResult.data ?? [])
    .map((importRow) => {
      const template = templatesById.get(importRow.template_id);
      if (!template || !importRow.retell_agent_id) {
        return null;
      }

      return {
        template_id: template.id,
        template_name: template.name,
        template_slug: template.slug,
        retell_agent_id: importRow.retell_agent_id,
        required_variables: template.required_variables ?? [],
        default_variables: template.default_variables ?? {},
        import_variables: recordFromUnknown(importRow.retell_response?.variables),
      };
    })
    .filter((option): option is TemplateAgentOption => Boolean(option));

  return {
    importableTemplates: templates,
    templateAgents,
  };
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

export default async function CampaignsPage() {
  const current = await getCurrentUser();
  const [
    { agents, phoneNumbers, voices, connectionState, issues },
    { importableTemplates, templateAgents },
    webhookBaseUrl,
    campaignsResult,
  ] = await Promise.all([
    loadRetellOptions(),
    loadAgentTemplates(current.profile.tenant_id),
    getWebhookBaseUrl(),
    supabaseAdmin
      .from("campaigns")
      .select("id, name, purpose, status, created_at, profiles(full_name, email)")
      .eq("tenant_id", current.profile.tenant_id)
      .order("created_at", { ascending: false })
      .returns<CampaignRow[]>(),
  ]);
  const campaigns = campaignsResult.data ?? [];
  const retellConnected = connectionState === "ok";
  const uploadableCampaigns = campaigns.filter(
    (campaign) => !["completed", "cancelled", "running"].includes(campaign.status)
  );
  const hasRunningCampaigns = campaigns.some((campaign) => campaign.status === "running");
  const campaignIds = campaigns.map((campaign) => campaign.id);
  const tasksResult =
    campaignIds.length > 0
      ? await supabaseAdmin
          .from("call_tasks")
          .select("campaign_id, status")
          .eq("tenant_id", current.profile.tenant_id)
          .in("campaign_id", campaignIds)
          .returns<TaskRow[]>()
      : { data: [] as TaskRow[] };
  const tasks = tasksResult.data ?? [];

  return (
    <div className="grid gap-4">
      <PageHeader
        eyebrow="Operations"
        title="Campaigns"
        description={
          <span>
            Create outbound AI calling campaigns and monitor dispatcher progress.{" "}
            <Link className="font-medium text-fg-link hover:underline" href="/campaign-call-list-template.csv">
              Need a CSV format? Download our template.
            </Link>
          </span>
        }
        actions={
          retellConnected ? (
            <div className="flex flex-wrap gap-2">
              <NewCampaignDialog
                agents={agents}
                phoneNumbers={phoneNumbers}
                templateAgents={templateAgents}
                importableTemplates={importableTemplates}
                voices={voices}
                tenantName={current.tenant.name}
                webhookBaseUrl={webhookBaseUrl}
              />
              <ImportCallListDialog
                campaigns={uploadableCampaigns}
                hasRunningCampaigns={hasRunningCampaigns}
                agents={agents}
                phoneNumbers={phoneNumbers}
                trigger={
                  <>
                    <UploadCloudIcon />
                    Import calling list
                  </>
                }
              />
            </div>
          ) : null
        }
      />

      {!retellConnected ? (
        <RetellConnectionGuide connectionState={connectionState} issues={issues} />
      ) : null}

      {retellConnected && campaigns.length === 0 ? (
        <div className="grid gap-4 lg:grid-cols-2">
          <Card className="grid gap-4 p-6">
            <div>
              <h2 className="text-lg font-semibold">Test the AI by calling your own phone</h2>
              <p className="text-sm text-muted-foreground">
                Place a one-off self-test call before building your first campaign.
              </p>
            </div>
            <SelfTestCard agents={agents} phoneNumbers={phoneNumbers} />
          </Card>
          <Card className="grid gap-4 p-6">
            <div>
              <h2 className="text-lg font-semibold">Have a list ready?</h2>
              <p className="text-sm text-muted-foreground">
                Import a CSV, create a campaign draft, and review the queued tasks before
                calling starts.
              </p>
            </div>
            <ImportCallListDialog
              campaigns={uploadableCampaigns}
              hasRunningCampaigns={hasRunningCampaigns}
              agents={agents}
              phoneNumbers={phoneNumbers}
              trigger={
                <>
                  <UploadCloudIcon />
                  Import a calling list
                </>
              }
            />
          </Card>
          <Card className="grid gap-3 p-6 lg:col-span-2">
            <div>
              <h2 className="text-lg font-semibold">How CSVs work</h2>
              <p className="text-sm text-muted-foreground">
                Use a simple spreadsheet export. We validate the file before adding any tasks.
              </p>
            </div>
            <ul className="grid gap-2 text-sm text-muted-foreground">
              <li>
                Headers required: at minimum &apos;phone&apos;. Optional: &apos;name&apos;, plus
                any extra columns become merge_fields the agent can read during the call
                (e.g., &apos;last_visit_date&apos;, &apos;preferred_language&apos;).
              </li>
              <li>
                Phone numbers can be in any format — we normalize them to E.164. Bad numbers
                get listed in a downloadable rejection report.
              </li>
              <li>
                Up to 5000 rows per upload, 2 MB max. Larger lists: split into multiple
                uploads to the same campaign.
              </li>
            </ul>
          </Card>
        </div>
      ) : null}

      {campaigns.length ? (
        <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
          {campaigns.map((campaign) => {
            const counts = taskCounts(tasks, campaign.id);
            const progress = counts.total ? Math.round((counts.completed / counts.total) * 100) : 0;

            return (
              <Card
                key={campaign.id}
                interactive
                elevation="raised"
                padding="comfortable"
                className="hover:-translate-y-0.5 hover:shadow-md"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h2 className="truncate font-heading text-lg font-semibold">
                      {campaign.name}
                    </h2>
                    <p className="mt-1 text-sm text-fg-tertiary">
                      Created by {createdBy(campaign)} · {formatDate(campaign.created_at)}
                    </p>
                  </div>
                  <Badge
                    variant={statusVariants[campaign.status] ?? "neutral"}
                    dot
                    className={cn(campaign.status === "running" && "[&>span:first-child]:animate-pulse")}
                  >
                    {campaign.status}
                  </Badge>
                </div>

                <div className="flex flex-wrap gap-2">
                  <Badge variant="accent">{campaign.purpose.replaceAll("_", " ")}</Badge>
                  <Badge variant="neutral">{counts.total} tasks</Badge>
                </div>

                <div className="grid gap-2">
                  <div className="flex items-center justify-between text-xs text-fg-tertiary">
                    <span>Progress</span>
                    <span>{counts.completed}/{counts.total || 0} completed</span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-bg-muted">
                    <div
                      className="h-full rounded-full bg-accent-secondary"
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-4 gap-2">
                  <MiniStat icon={ClockIcon} label="Queued" value={counts.queued} />
                  <MiniStat icon={Loader2Icon} label="Active" value={counts.inProgress} />
                  <MiniStat icon={CheckCircle2Icon} label="Done" value={counts.completed} />
                  <MiniStat icon={XCircleIcon} label="Failed" value={counts.failed} />
                </div>

                <div className="mt-auto flex flex-wrap items-center gap-2">
                  <CampaignStatusActions
                    campaignId={campaign.id}
                    status={campaign.status}
                    retellConnected={retellConnected}
                  />
                  <Button
                    variant="secondary"
                    size="sm"
                    render={<Link href={`/dashboard/campaigns/${campaign.id}`} />}
                  >
                    Open
                    <ArrowRightIcon />
                  </Button>
                </div>
              </Card>
            );
          })}
        </div>
      ) : retellConnected ? (
        <Card className="p-8 text-center">
          <p className="font-medium">No campaigns yet</p>
          <p className="text-sm text-muted-foreground">
            Create a campaign draft or use the self-test above to place your first outbound call.
          </p>
        </Card>
      ) : null}
    </div>
  );
}

function MiniStat({
  icon: Icon,
  label,
  value,
}: {
  icon: ComponentType<{ className?: string }>;
  label: string;
  value: number;
}) {
  return (
    <div className="rounded-lg border border-border-subtle bg-bg-surface-sunken p-2">
      <Icon className="mb-1 size-3.5 text-accent-primary" />
      <p className="text-base font-semibold tabular-nums">{value}</p>
      <p className="text-[0.68rem] text-fg-tertiary">{label}</p>
    </div>
  );
}
