import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { UploadCloudIcon } from "lucide-react";
import {
  AddSingleTaskDialog,
  CampaignConfigForm,
  CampaignHeaderActions,
  TaskRowActions,
} from "@/app/dashboard/campaigns/campaign-controls";
import { CampaignUploadDialog } from "@/app/dashboard/campaigns/[id]/upload-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/components/page-header";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { getCurrentUser } from "@/lib/auth";
import { listAgents, listPhoneNumbers } from "@/lib/retell/client";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { cn } from "@/lib/utils";

type CampaignDetailPageProps = {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

type CampaignRow = {
  id: string;
  name: string;
  description: string | null;
  purpose: string;
  status: string;
  agent_id: string;
  from_phone: string;
  max_concurrent: number;
  max_attempts_per_task: number;
  retry_delay_minutes: number;
  call_window_start: string | null;
  call_window_end: string | null;
  call_window_timezone: string | null;
  script_variables: Record<string, unknown> | null;
};

type TaskRow = {
  id: string;
  to_phone: string;
  contact_name: string | null;
  status: string;
  attempts: number;
  last_attempt_at: string | null;
  next_attempt_at: string | null;
  last_retell_call_id: string | null;
  disposition: string | null;
  created_at: string | null;
};

type IntakeCallRow = {
  id: string;
  retell_call_id: string;
  duration_seconds: number | null;
};

type CallEventRow = {
  id: string;
  call_id: string | null;
  event_type: string;
  payload: Record<string, unknown> | null;
  created_at: string | null;
};

type UploadBatchRow = {
  id: string;
  filename: string | null;
  row_count_total: number;
  row_count_accepted: number;
  row_count_rejected: number;
  created_at: string | null;
  profiles?: {
    full_name: string | null;
    email: string | null;
  } | null;
};

const tabLabels = {
  "call-list": "Call list",
  config: "Script & configuration",
  activity: "Activity",
} as const;

const statusVariants: Record<string, "neutral" | "info" | "success" | "warning" | "danger"> = {
  draft: "neutral",
  ready: "info",
  running: "success",
  paused: "warning",
  completed: "neutral",
  cancelled: "danger",
};

const taskStatuses = [
  "queued",
  "scheduled",
  "in_progress",
  "completed",
  "no_answer",
  "failed",
  "voicemail",
  "busy",
  "cancelled",
] as const;

const finalTaskStatuses = new Set([
  "completed",
  "failed",
  "cancelled",
  "no_answer",
  "busy",
  "voicemail",
]);

function formatDate(value: string | null) {
  if (!value) return "";
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(value));
}

function relativeTime(value: string | null) {
  if (!value) return "";
  const seconds = Math.round((new Date(value).getTime() - Date.now()) / 1000);
  const formatter = new Intl.RelativeTimeFormat("en", { numeric: "auto" });
  const abs = Math.abs(seconds);
  if (abs < 3600) return formatter.format(Math.round(seconds / 60), "minute");
  if (abs < 86400) return formatter.format(Math.round(seconds / 3600), "hour");
  return formatter.format(Math.round(seconds / 86400), "day");
}

function csvEscape(value: unknown) {
  const text = value === null || value === undefined ? "" : String(value);
  return `"${text.replaceAll('"', '""')}"`;
}

function csvHref(tasks: TaskRow[], maxAttempts: number) {
  const lines = [
    ["contact_name", "masked_phone", "status", "attempts", "max_attempts", "disposition"]
      .map(csvEscape)
      .join(","),
    ...tasks.map((task) =>
      [
        task.contact_name ?? "",
        task.to_phone,
        task.status,
        task.attempts,
        maxAttempts,
        task.disposition ?? "",
      ]
        .map(csvEscape)
        .join(",")
    ),
  ];

  return `data:text/csv;charset=utf-8,${encodeURIComponent(lines.join("\n"))}`;
}

function statCounts(tasks: TaskRow[]) {
  return {
    queued: tasks.filter((task) => task.status === "queued").length,
    scheduled: tasks.filter((task) => task.status === "scheduled").length,
    inProgress: tasks.filter((task) => task.status === "in_progress").length,
    completed: tasks.filter((task) => task.status === "completed").length,
    noAnswer: tasks.filter((task) => task.status === "no_answer").length,
    failed: tasks.filter((task) => task.status === "failed").length,
    voicemail: tasks.filter(
      (task) => task.status === "voicemail" || task.disposition === "voicemail_left"
    ).length,
  };
}

function attemptsRemaining(tasks: TaskRow[], maxAttempts: number) {
  return tasks
    .filter((task) => !finalTaskStatuses.has(task.status))
    .reduce((sum, task) => sum + Math.max(maxAttempts - task.attempts, 0), 0);
}

function estimatedCompletion(
  remainingAttempts: number,
  avgDurationSeconds: number,
  maxConcurrent: number
) {
  if (remainingAttempts <= 0) return "Complete";
  const seconds = Math.ceil((remainingAttempts * avgDurationSeconds) / Math.max(maxConcurrent, 1));
  if (seconds < 3600) return `${Math.max(1, Math.ceil(seconds / 60))} min`;
  return `${Math.ceil(seconds / 3600)} hr`;
}

function payloadString(payload: Record<string, unknown> | null, key: string) {
  const value = payload?.[key];
  return typeof value === "string" ? value : null;
}

function uploadedBy(batch: UploadBatchRow) {
  return batch.profiles?.full_name || batch.profiles?.email || "Unknown";
}

async function loadRetellOptions() {
  const [agentsResult, phoneNumbersResult] = await Promise.allSettled([
    listAgents(),
    listPhoneNumbers(),
  ]);

  return {
    agents: agentsResult.status === "fulfilled" ? agentsResult.value : [],
    phoneNumbers: phoneNumbersResult.status === "fulfilled" ? phoneNumbersResult.value : [],
  };
}

function StatCard({ label, value }: { label: string; value: string | number }) {
  return (
    <Card elevation="raised" padding="compact">
      <p className="text-xs font-medium tracking-wide text-fg-tertiary uppercase">{label}</p>
      <p className="mt-1 text-lg font-semibold tabular-nums text-fg-primary">{value}</p>
    </Card>
  );
}

function RecentUploadsPanel({
  campaignId,
  uploads,
}: {
  campaignId: string;
  uploads: UploadBatchRow[];
}) {
  if (uploads.length === 0) {
    return (
      <Card elevation="raised" padding="compact" className="text-sm text-fg-tertiary">
        No recent uploads yet.
      </Card>
    );
  }

  return (
    <details className="rounded-lg border border-border-default bg-bg-surface p-4 shadow-xs">
      <summary className="cursor-pointer font-medium">Recent uploads</summary>
      <div className="mt-3 overflow-x-auto">
        <Table className="min-w-[800px]">
          <TableHeader>
            <TableRow>
              <TableHead>Filename</TableHead>
              <TableHead>Total</TableHead>
              <TableHead>Accepted</TableHead>
              <TableHead>Rejected</TableHead>
              <TableHead>Uploaded by</TableHead>
              <TableHead>Timestamp</TableHead>
              <TableHead>Rejected rows</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {uploads.map((upload) => (
              <TableRow key={upload.id}>
                <TableCell>{upload.filename ?? "CSV upload"}</TableCell>
                <TableCell>{upload.row_count_total}</TableCell>
                <TableCell>{upload.row_count_accepted}</TableCell>
                <TableCell>{upload.row_count_rejected}</TableCell>
                <TableCell>{uploadedBy(upload)}</TableCell>
                <TableCell>{formatDate(upload.created_at)}</TableCell>
                <TableCell>
                  {upload.row_count_rejected > 0 ? (
                    <Link
                      className="underline"
                      href={`/api/campaigns/${campaignId}/uploads/${upload.id}/rejected`}
                    >
                      Download rejected rows
                    </Link>
                  ) : (
                    "None"
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </details>
  );
}

function AddTasksCard({
  campaign,
  hasTasks,
  canAdmin,
}: {
  campaign: Pick<CampaignRow, "id" | "name" | "status">;
  hasTasks: boolean;
  canAdmin: boolean;
}) {
  const canAddTasks = ["draft", "ready", "paused"].includes(campaign.status);
  const canReopen = campaign.status === "completed";
  const content = (
    <div className="grid gap-4">
      <div>
        <h2 className="font-heading text-lg font-semibold">Add tasks</h2>
        <p className="text-sm text-fg-secondary">
          {!canAddTasks
            ? canReopen
              ? "Reopen this campaign to add more numbers."
              : campaign.status === "running"
              ? "Pause this campaign before adding more tasks."
              : "This campaign cannot accept new tasks."
            : hasTasks
              ? "Add more numbers to this campaign."
              : "This campaign has no tasks yet. Upload a CSV or add a single number to start."}
        </p>
      </div>
      {canAddTasks ? (
        <div className="flex flex-wrap gap-2">
          <CampaignUploadDialog
            campaignId={campaign.id}
            campaignName={campaign.name}
            triggerVariant="default"
            trigger={
              <>
                <UploadCloudIcon />
                Upload calling list (CSV)
              </>
            }
          />
          <AddSingleTaskDialog campaignId={campaign.id} />
        </div>
      ) : (
        <div className="grid gap-3">
          <p className="rounded-lg border border-warning-border bg-warning-bg p-3 text-sm text-warning-fg">
            CSV tasks can only be uploaded while a campaign is draft, ready, or paused.
          </p>
          {canReopen ? (
            <div className="flex flex-wrap gap-2">
              <CampaignHeaderActions
                campaignId={campaign.id}
                status={campaign.status}
                canAdmin={canAdmin}
              />
              <Button
                type="button"
                variant="outline"
                render={<Link href="/dashboard/campaigns/import" />}
              >
                Import as new campaign
              </Button>
            </div>
          ) : null}
        </div>
      )}
    </div>
  );

  if (hasTasks) {
    return (
      <Card elevation="raised" padding="compact">
        <details>
          <summary className="cursor-pointer font-medium">Add tasks</summary>
          <div className="mt-3">{content}</div>
        </details>
      </Card>
    );
  }

  return (
    <Card
      elevation="raised"
      padding="comfortable"
      className="animate-pulse border border-border-emphasis"
    >
      {content}
    </Card>
  );
}

export default async function CampaignDetailPage({
  params,
  searchParams,
}: CampaignDetailPageProps) {
  const current = await getCurrentUser();
  const parsedParams = z.object({ id: z.string().uuid() }).safeParse(await params);
  const rawSearchParams = await searchParams;

  if (!parsedParams.success) {
    notFound();
  }

  const selectedTab = z
    .enum(["call-list", "config", "activity"])
    .catch("call-list")
    .parse(rawSearchParams.tab);
  const selectedStatuses = z
    .array(z.enum(taskStatuses))
    .catch([])
    .parse(
      Array.isArray(rawSearchParams.status)
        ? rawSearchParams.status
        : rawSearchParams.status
          ? [rawSearchParams.status]
          : []
    );
  const phoneSearch =
    typeof rawSearchParams.phone === "string" ? rawSearchParams.phone.trim() : "";
  const uploadedTaskCount =
    typeof rawSearchParams.upload_tasks === "string"
      ? Number.parseInt(rawSearchParams.upload_tasks, 10)
      : null;
  const uploadedFilename =
    typeof rawSearchParams.upload_file === "string"
      ? rawSearchParams.upload_file
      : "CSV upload";

  const { data: campaign } = await supabaseAdmin
    .from("campaigns")
    .select(
      "id, name, description, purpose, status, agent_id, from_phone, max_concurrent, max_attempts_per_task, retry_delay_minutes, call_window_start, call_window_end, call_window_timezone, script_variables"
    )
    .eq("tenant_id", current.profile.tenant_id)
    .eq("id", parsedParams.data.id)
    .single<CampaignRow>();

  if (!campaign) {
    notFound();
  }

  const [{ agents, phoneNumbers }, allTasksResult, callsResult, uploadsResult] = await Promise.all([
    loadRetellOptions(),
    supabaseAdmin
      .from("call_tasks")
      .select(
        "id, to_phone, contact_name, status, attempts, last_attempt_at, next_attempt_at, last_retell_call_id, disposition, created_at"
      )
      .eq("tenant_id", current.profile.tenant_id)
      .eq("campaign_id", campaign.id)
      .order("created_at", { ascending: false })
      .returns<TaskRow[]>(),
    supabaseAdmin
      .from("intake_calls")
      .select("id, retell_call_id, duration_seconds")
      .eq("tenant_id", current.profile.tenant_id)
      .eq("campaign_id", campaign.id)
      .returns<IntakeCallRow[]>(),
    supabaseAdmin
      .from("call_upload_batches")
      .select("id, filename, row_count_total, row_count_accepted, row_count_rejected, created_at, profiles(full_name, email)")
      .eq("tenant_id", current.profile.tenant_id)
      .eq("campaign_id", campaign.id)
      .order("created_at", { ascending: false })
      .limit(10)
      .returns<UploadBatchRow[]>(),
  ]);
  const allTasks = allTasksResult.data ?? [];
  const calls = callsResult.data ?? [];
  const uploads = uploadsResult.data ?? [];
  const retellCallIdToCallId = new Map(calls.map((call) => [call.retell_call_id, call.id]));
  const taskIds = new Set(allTasks.map((task) => task.id));
  const callIds = new Set(calls.map((call) => call.id));
  const filteredTasks = allTasks.filter((task) => {
    if (
      selectedStatuses.length > 0 &&
      !selectedStatuses.includes(task.status as (typeof taskStatuses)[number])
    ) {
      return false;
    }

    if (phoneSearch && !task.to_phone.includes(phoneSearch)) {
      return false;
    }

    return true;
  });
  const counts = statCounts(allTasks);
  const remainingAttempts = attemptsRemaining(allTasks, campaign.max_attempts_per_task);
  const completedCallDurations = calls
    .map((call) => call.duration_seconds)
    .filter((duration): duration is number => typeof duration === "number" && duration > 0);
  const avgDurationSeconds = completedCallDurations.length
    ? Math.round(
        completedCallDurations.reduce((sum, duration) => sum + duration, 0) /
          completedCallDurations.length
      )
    : 180;
  const { data: eventCandidates } = await supabaseAdmin
    .from("call_events")
    .select("id, call_id, event_type, payload, created_at")
    .eq("tenant_id", current.profile.tenant_id)
    .order("created_at", { ascending: false })
    .limit(500)
    .returns<CallEventRow[]>();
  const events = (eventCandidates ?? [])
    .filter((event) => {
      const callTaskId = payloadString(event.payload, "call_task_id");
      const campaignId = payloadString(event.payload, "campaign_id");
      return (
        campaignId === campaign.id ||
        (event.call_id ? callIds.has(event.call_id) : false) ||
        (callTaskId ? taskIds.has(callTaskId) : false)
      );
    })
    .slice(0, 200);
  const canAdmin = ["owner", "admin"].includes(current.profile.role);
  const hasTasks = allTasks.length > 0;

  const tabHref = (tab: keyof typeof tabLabels) => {
    const next = new URLSearchParams();
    next.set("tab", tab);
    return `/dashboard/campaigns/${campaign.id}?${next.toString()}`;
  };

  return (
    <div className="grid gap-5">
      <PageHeader
        eyebrow={
          <Button variant="link" className="h-auto px-0" render={<Link href="/dashboard/campaigns" />}>
            Back to campaigns
          </Button>
        }
        title={
          <span className="inline-flex flex-wrap items-center gap-2">
            {campaign.name}
            <Badge variant={statusVariants[campaign.status] ?? "neutral"} dot>
              {campaign.status}
            </Badge>
            <Badge variant="accent">{campaign.purpose.replaceAll("_", " ")}</Badge>
          </span>
        }
        description={campaign.description || "Outbound campaign details."}
        actions={
          <CampaignHeaderActions
            campaignId={campaign.id}
            status={campaign.status}
            canAdmin={canAdmin}
          />
        }
      />

      {hasTasks ? (
        <section className="grid gap-3 lg:grid-cols-[minmax(18rem,0.85fr)_minmax(0,1.15fr)]">
          <AddTasksCard campaign={campaign} hasTasks={hasTasks} canAdmin={canAdmin} />
          <RecentUploadsPanel campaignId={campaign.id} uploads={uploads} />
        </section>
      ) : (
        <AddTasksCard campaign={campaign} hasTasks={hasTasks} canAdmin={canAdmin} />
      )}

      {uploadedTaskCount !== null && Number.isFinite(uploadedTaskCount) ? (
        <Card className="border-success-border bg-success-bg p-4 text-success-fg">
          <p className="font-medium">
            {uploadedTaskCount} tasks added from {uploadedFilename}. Start the campaign when
            you&apos;re ready to begin calling.
          </p>
        </Card>
      ) : null}

      <section className="grid gap-3 md:grid-cols-4 xl:grid-cols-9">
        <StatCard label="Queued" value={counts.queued} />
        <StatCard label="Scheduled" value={counts.scheduled} />
        <StatCard label="In progress" value={counts.inProgress} />
        <StatCard label="Completed" value={counts.completed} />
        <StatCard label="No answer" value={counts.noAnswer} />
        <StatCard label="Failed" value={counts.failed} />
        <StatCard label="Voicemail left" value={counts.voicemail} />
        <StatCard label="Attempts remaining" value={remainingAttempts} />
        <StatCard
          label="Estimated completion"
          value={estimatedCompletion(
            remainingAttempts,
            avgDurationSeconds,
            campaign.max_concurrent
          )}
        />
      </section>

      <nav className="flex flex-wrap gap-2 border-b border-border-subtle">
        {(Object.keys(tabLabels) as Array<keyof typeof tabLabels>).map((tab) => (
          <Link
            key={tab}
            href={tabHref(tab)}
            className={cn(
              "px-3 py-2 text-sm font-medium text-fg-tertiary",
              selectedTab === tab && "border-b-2 border-accent-secondary text-fg-primary"
            )}
          >
            {tabLabels[tab]}
          </Link>
        ))}
      </nav>

      {selectedTab === "call-list" ? (
        <div className="grid gap-3">
          <form className="flex flex-wrap items-end gap-3 rounded-xl border border-border-default bg-bg-surface p-4 shadow-xs">
            <input type="hidden" name="tab" value="call-list" />
            <label className="grid gap-1">
              <span className="text-xs font-medium text-fg-tertiary">Phone search</span>
              <Input
                name="phone"
                defaultValue={phoneSearch}
                placeholder="+1313"
              />
            </label>
            <fieldset className="flex flex-wrap gap-2">
              <legend className="mb-1 text-xs font-medium text-fg-tertiary">Status</legend>
              {taskStatuses.map((status) => (
                <label key={status} className="flex items-center gap-1 rounded-full border border-border-subtle px-2 py-1 text-xs">
                  <input
                    type="checkbox"
                    name="status"
                    value={status}
                    defaultChecked={selectedStatuses.includes(status)}
                  />
                  {status}
                </label>
              ))}
            </fieldset>
            <Button type="submit" variant="outline">
              Apply filters
            </Button>
            <Button
              type="button"
              variant="outline"
              render={
                <a
                  href={csvHref(filteredTasks, campaign.max_attempts_per_task)}
                  download={`${campaign.name.replaceAll(/\W+/g, "-").toLowerCase()}-tasks.csv`}
                />
              }
            >
              Export CSV
            </Button>
          </form>

          <div className="flex flex-wrap items-center gap-2 rounded-xl border border-border-subtle bg-bg-surface-sunken p-3">
            <span className="mr-auto text-sm font-medium">Add tasks</span>
            <span className="text-sm text-fg-tertiary">
              Use the Add Tasks card at the top of this page to upload a CSV or add one number.
            </span>
          </div>

          <Table className="min-w-[1200px]" stickyHeader>
              <TableHeader>
                <TableRow>
                  <TableHead>Contact name</TableHead>
                  <TableHead>Phone</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Attempts / Max</TableHead>
                  <TableHead>Last attempt</TableHead>
                  <TableHead>Next attempt</TableHead>
                  <TableHead>Disposition</TableHead>
                  <TableHead>Last call</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredTasks.map((task) => {
                  const lastCallId = task.last_retell_call_id
                    ? retellCallIdToCallId.get(task.last_retell_call_id)
                    : null;
                  const lastCallHref = lastCallId ? `/dashboard/calls/${lastCallId}` : null;

                  return (
                    <TableRow key={task.id}>
                      <TableCell>{task.contact_name || "Unnamed"}</TableCell>
                      <TableCell className="font-mono">{task.to_phone}</TableCell>
                      <TableCell>
                        <Badge variant="neutral">{task.status}</Badge>
                      </TableCell>
                      <TableCell>
                        {task.attempts} / {campaign.max_attempts_per_task}
                      </TableCell>
                      <TableCell>{relativeTime(task.last_attempt_at)}</TableCell>
                      <TableCell>
                        {task.status === "scheduled" ? relativeTime(task.next_attempt_at) : ""}
                      </TableCell>
                      <TableCell>{task.disposition ?? ""}</TableCell>
                      <TableCell>
                        {lastCallHref ? (
                          <Link className="underline" href={lastCallHref}>
                            View
                          </Link>
                        ) : "None"}
                      </TableCell>
                      <TableCell>
                        <TaskRowActions
                          campaignId={campaign.id}
                          taskId={task.id}
                          status={task.status}
                          lastCallHref={lastCallHref}
                        />
                      </TableCell>
                    </TableRow>
                  );
                })}
                {filteredTasks.length === 0 ? (
                  <TableRow>
                    <TableCell className="p-6 text-center text-fg-tertiary" colSpan={9}>
                      No tasks match the current filters.
                    </TableCell>
                  </TableRow>
                ) : null}
              </TableBody>
          </Table>
        </div>
      ) : null}

      {selectedTab === "config" ? (
        <Card className="p-4">
          <CampaignConfigForm
            campaign={campaign}
            agents={agents}
            phoneNumbers={phoneNumbers}
          />
        </Card>
      ) : null}

      {selectedTab === "activity" ? (
        <Card className="max-h-[700px] overflow-auto" padding="compact">
          <div className="relative grid gap-0">
            {events.map((event) => (
              <div key={event.id} className="relative grid gap-1 border-l-2 border-border-subtle py-3 pl-5">
                <span className="absolute -left-[5px] top-5 size-2 rounded-full bg-accent-secondary" />
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <Badge variant="neutral">{event.event_type}</Badge>
                  <span className="text-xs text-fg-tertiary">{formatDate(event.created_at)}</span>
                </div>
                <p className="text-xs text-fg-tertiary">
                  call_task_id: {payloadString(event.payload, "call_task_id") ?? "n/a"}
                  {" · "}
                  disposition: {payloadString(event.payload, "disposition") ?? "n/a"}
                </p>
              </div>
            ))}
            {events.length === 0 ? (
              <p className="p-6 text-center text-sm text-muted-foreground">
                No campaign activity yet.
              </p>
            ) : null}
          </div>
        </Card>
      ) : null}
    </div>
  );
}
