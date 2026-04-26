import Link from "next/link";
import { headers } from "next/headers";
import {
  AlertTriangleIcon,
  ArrowRightIcon,
  CalendarClockIcon,
  CheckCircle2Icon,
  MegaphoneIcon,
  PhoneCallIcon,
  SparklesIcon,
} from "lucide-react";
import { loadDashboardOverview, type DashboardLeadItem } from "@/app/dashboard/query";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { getCurrentUser } from "@/lib/auth";
import { formatPhone, formatRelativeTime, formatTime } from "@/lib/formatters";
import { loadRetellSetupStatus, type RetellSetupStatus } from "@/lib/retell/setup-status";
import { cn } from "@/lib/utils";

function getAppUrl(host: string | null, proto: string | null) {
  if (process.env.NEXT_PUBLIC_APP_URL) {
    return process.env.NEXT_PUBLIC_APP_URL.replace(/\/$/, "");
  }

  return host ? `${proto ?? "https"}://${host}` : "http://localhost:3000";
}

function setupIssueLabel(key: string) {
  const labels: Record<string, string> = {
    apiKey: "Retell API key",
    webhookSecret: "Webhook secret",
    phoneNumber: "Phone number",
    agent: "Agent",
    linkedPair: "Phone-agent link",
    webhookConfigured: "Agent webhook",
    testCall: "Test call",
  };

  return labels[key] ?? key;
}

function urgencyVariant(urgency: string | null): "emergent" | "urgent" | "routine" | "informational" {
  if (urgency === "emergent" || urgency === "urgent" || urgency === "informational") {
    return urgency;
  }

  return "routine";
}

function leadTypeLabel(type: string) {
  return type
    .split("_")
    .map((part) => part[0]?.toUpperCase() + part.slice(1))
    .join(" ");
}

export default async function DashboardPage() {
  const requestHeaders = await headers();
  const current = await getCurrentUser();
  const appUrl = getAppUrl(
    requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host"),
    requestHeaders.get("x-forwarded-proto")
  );
  const [overview, setup] = await Promise.all([
    loadDashboardOverview(current.profile.tenant_id),
    loadRetellSetupStatus({
      tenantId: current.profile.tenant_id,
      appUrl,
    }),
  ]);
  const setupIssues = Object.entries(setup.steps)
    .filter(([, state]) => state !== "complete")
    .map(([key]) => setupIssueLabel(key));

  return (
    <div className="grid gap-5">
      <PageHeader
        eyebrow="Operations"
        title="Dashboard"
        description="Today's intake snapshot, live calls, urgent work, campaign progress, and setup health."
        actions={
          <Button render={<Link href="/dashboard/leads" />} variant="secondary">
            Open lead queue
            <ArrowRightIcon />
          </Button>
        }
      />

      <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
        <DashboardStat
          label="Today's intakes"
          value={overview.stats.todayIntakes}
          description="New leads created today"
          href="/dashboard/leads"
        />
        <DashboardStat
          label="Calls in progress"
          value={overview.stats.callsInProgress}
          description="Started calls without an end event"
          tone={overview.stats.callsInProgress > 0 ? "info" : "neutral"}
          href="/dashboard/calls"
        />
        <DashboardStat
          label="Urgent leads"
          value={overview.stats.urgentLeads}
          description="Emergent or urgent active leads"
          tone={overview.stats.urgentLeads > 0 ? "danger" : "neutral"}
          href="/dashboard/leads?urgency=emergent,urgent"
        />
        <DashboardStat
          label="Follow-ups due"
          value={overview.stats.followupsDueToday}
          description="Due today or overdue"
          tone={overview.stats.followupsDueToday > 0 ? "warning" : "neutral"}
          href="/dashboard/leads"
        />
        <DashboardStat
          label="Setup health"
          value={setup.allComplete ? "OK" : setupIssues.length}
          description={setup.allComplete ? "Voice setup is healthy" : "Items need attention"}
          tone={setup.allComplete ? "success" : "warning"}
          href="/dashboard/setup"
        />
      </section>

      <section className="grid gap-5 xl:grid-cols-[1.15fr_0.85fr]">
        <Card elevation="raised" className="gap-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="text-xs font-medium tracking-wide text-fg-tertiary uppercase">
                Today&apos;s intake queue
              </p>
              <h2 className="font-heading text-xl font-semibold">New work from the phones</h2>
              <p className="mt-1 text-sm text-fg-secondary">
                A real dashboard view of the queue shown on the marketing page.
              </p>
            </div>
            <Badge variant={overview.liveCalls.length ? "success" : "neutral"} dot>
              {overview.liveCalls.length ? "Live activity" : "Quiet"}
            </Badge>
          </div>

          {overview.todayLeads.length ? (
            <div className="grid gap-3">
              {overview.todayLeads.map((lead) => (
                <LeadRow key={lead.id} lead={lead} />
              ))}
            </div>
          ) : (
            <EmptyState
              icon={SparklesIcon}
              title="No intakes yet today"
              copy="New Retell intake calls and manual leads will appear here as they are created."
            />
          )}
        </Card>

        <div className="grid gap-5">
          <LiveCallsCard calls={overview.liveCalls} />
          <CampaignCard campaign={overview.lastCampaign} />
          <SetupHealthCard setup={setup} issues={setupIssues} />
        </div>
      </section>

      <section className="grid gap-5 lg:grid-cols-2">
        <ActionList
          title="Urgent and emergent leads"
          description="High-priority active leads that need a coordinator."
          emptyTitle="No urgent leads"
          emptyCopy="Emergent and urgent leads will be highlighted here."
          items={overview.urgentLeads}
          href="/dashboard/leads?urgency=emergent,urgent"
        />
        <ActionList
          title="Follow-ups due"
          description="Callbacks and next steps due today or already overdue."
          emptyTitle="No follow-ups due"
          emptyCopy="Leads with due follow-up dates will appear here."
          items={overview.followupsDue}
          href="/dashboard/leads"
          showFollowup
        />
      </section>
    </div>
  );
}

function DashboardStat({
  label,
  value,
  description,
  href,
  tone = "neutral",
}: {
  label: string;
  value: string | number;
  description: string;
  href: string;
  tone?: "neutral" | "success" | "warning" | "danger" | "info";
}) {
  return (
    <Link href={href} className="focus-visible:shadow-focus">
      <Card
        elevation="raised"
        padding="compact"
        interactive
        className={cn(
          "h-full gap-2",
          tone === "danger" && "bg-danger-bg",
          tone === "warning" && "bg-warning-bg",
          tone === "success" && "bg-success-bg",
          tone === "info" && "bg-info-bg"
        )}
      >
        <p className="text-xs font-medium tracking-wide text-fg-tertiary uppercase">{label}</p>
        <p className="text-3xl font-semibold tabular-nums text-fg-primary">{value}</p>
        <p className="text-xs text-fg-secondary">{description}</p>
      </Card>
    </Link>
  );
}

function LeadRow({ lead, showFollowup = false }: { lead: DashboardLeadItem; showFollowup?: boolean }) {
  return (
    <Link
      href={`/dashboard/leads/${lead.id}`}
      className="grid gap-3 rounded-xl border border-border-subtle bg-bg-surface-sunken p-3 transition-colors hover:border-border-strong focus-visible:shadow-focus sm:grid-cols-[1fr_auto] sm:items-center"
    >
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <p className="font-medium text-fg-primary">{lead.displayName}</p>
          {lead.urgency ? (
            <Badge variant={urgencyVariant(lead.urgency)} tone="solid">
              {lead.urgency}
            </Badge>
          ) : null}
        </div>
        <p className="mt-1 text-xs text-fg-tertiary">
          {leadTypeLabel(lead.lead_type)}
          {lead.payer ? ` · ${lead.payer}` : ""}
          {lead.primaryPhone ? ` · ${formatPhone(lead.primaryPhone)}` : ""}
        </p>
      </div>
      <div className="text-left text-xs text-fg-tertiary sm:text-right">
        <p>{lead.assigneeName ? `Assigned to ${lead.assigneeName}` : "Unassigned"}</p>
        {showFollowup && lead.next_followup_at ? (
          <p className="font-medium text-warning-fg">Due {formatRelativeTime(lead.next_followup_at)}</p>
        ) : (
          <p>Updated {formatRelativeTime(lead.last_contact_at ?? lead.created_at)}</p>
        )}
      </div>
    </Link>
  );
}

function ActionList({
  title,
  description,
  emptyTitle,
  emptyCopy,
  items,
  href,
  showFollowup = false,
}: {
  title: string;
  description: string;
  emptyTitle: string;
  emptyCopy: string;
  items: DashboardLeadItem[];
  href: string;
  showFollowup?: boolean;
}) {
  return (
    <Card elevation="raised" className="gap-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="font-heading text-lg font-semibold">{title}</h2>
          <p className="mt-1 text-sm text-fg-secondary">{description}</p>
        </div>
        <Button render={<Link href={href} />} variant="ghost" size="sm">
          View all
          <ArrowRightIcon />
        </Button>
      </div>
      {items.length ? (
        <div className="grid gap-3">
          {items.map((lead) => (
            <LeadRow key={lead.id} lead={lead} showFollowup={showFollowup} />
          ))}
        </div>
      ) : (
        <EmptyState icon={CheckCircle2Icon} title={emptyTitle} copy={emptyCopy} />
      )}
    </Card>
  );
}

function LiveCallsCard({ calls }: { calls: Awaited<ReturnType<typeof loadDashboardOverview>>["liveCalls"] }) {
  return (
    <Card elevation="raised" padding="compact">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="font-heading text-lg font-semibold">Calls in progress</h2>
          <p className="mt-1 text-sm text-fg-secondary">Retell calls that have started but not ended.</p>
        </div>
        <PhoneCallIcon className="size-5 text-accent-primary" />
      </div>
      {calls.length ? (
        <div className="grid gap-2">
          {calls.map((call) => (
            <Link
              key={call.id}
              href={`/dashboard/calls/${call.id}`}
              className="flex items-center justify-between gap-3 rounded-lg border border-border-subtle p-3 hover:border-border-strong focus-visible:shadow-focus"
            >
              <div>
                <p className="font-medium">{formatPhone(call.caller_phone) || "Unknown caller"}</p>
                <p className="text-xs text-fg-tertiary">
                  {call.call_direction ?? "call"} · started {formatTime(call.call_started_at)}
                </p>
              </div>
              <Badge variant="success" dot>
                live
              </Badge>
            </Link>
          ))}
        </div>
      ) : (
        <EmptyState icon={PhoneCallIcon} title="No live calls" copy="Active inbound or outbound calls will appear here." />
      )}
    </Card>
  );
}

function CampaignCard({
  campaign,
}: {
  campaign: Awaited<ReturnType<typeof loadDashboardOverview>>["lastCampaign"];
}) {
  return (
    <Card elevation="raised" padding="compact">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="font-heading text-lg font-semibold">Last campaign run</h2>
          <p className="mt-1 text-sm text-fg-secondary">Latest outbound campaign and task progress.</p>
        </div>
        <MegaphoneIcon className="size-5 text-accent-primary" />
      </div>
      {campaign ? (
        <div className="grid gap-3">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="font-medium">{campaign.name}</p>
              <p className="text-xs text-fg-tertiary">
                Updated {formatRelativeTime(campaign.updated_at ?? campaign.created_at)}
              </p>
            </div>
            <Badge variant={campaign.status === "running" ? "success" : "neutral"} dot={campaign.status === "running"}>
              {campaign.status}
            </Badge>
          </div>
          <div className="grid grid-cols-4 gap-2 text-center">
            <MiniCount label="Queued" value={campaign.taskCounts.queued} />
            <MiniCount label="Active" value={campaign.taskCounts.inProgress} />
            <MiniCount label="Done" value={campaign.taskCounts.completed} />
            <MiniCount label="Failed" value={campaign.taskCounts.failed} />
          </div>
          <Button render={<Link href={`/dashboard/campaigns/${campaign.id}`} />} variant="secondary" size="sm">
            Open campaign
            <ArrowRightIcon />
          </Button>
        </div>
      ) : (
        <EmptyState icon={MegaphoneIcon} title="No campaigns yet" copy="Create a campaign to see dispatcher progress here." />
      )}
    </Card>
  );
}

function SetupHealthCard({ setup, issues }: { setup: RetellSetupStatus; issues: string[] }) {
  return (
    <Card elevation="raised" padding="compact">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="font-heading text-lg font-semibold">Setup health</h2>
          <p className="mt-1 text-sm text-fg-secondary">
            Voice, webhook, phone number, and test-call readiness.
          </p>
        </div>
        {setup.allComplete ? (
          <CheckCircle2Icon className="size-5 text-success-fg" />
        ) : (
          <AlertTriangleIcon className="size-5 text-warning-fg" />
        )}
      </div>
      {setup.allComplete ? (
        <p className="rounded-lg border border-success-border bg-success-bg p-3 text-sm text-success-fg">
          Retell setup is complete and the latest test call requirement has been met.
        </p>
      ) : (
        <div className="grid gap-2">
          {issues.slice(0, 4).map((issue) => (
            <div key={issue} className="flex items-center gap-2 rounded-lg border border-warning-border bg-warning-bg p-2 text-sm text-warning-fg">
              <CalendarClockIcon className="size-4" />
              {issue}
            </div>
          ))}
          <Button render={<Link href="/dashboard/setup" />} variant="secondary" size="sm">
            Open setup
            <ArrowRightIcon />
          </Button>
        </div>
      )}
    </Card>
  );
}

function MiniCount({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg bg-bg-surface-sunken p-2">
      <p className="text-lg font-semibold tabular-nums">{value}</p>
      <p className="text-[11px] text-fg-tertiary">{label}</p>
    </div>
  );
}

function EmptyState({
  icon: Icon,
  title,
  copy,
}: {
  icon: typeof SparklesIcon;
  title: string;
  copy: string;
}) {
  return (
    <div className="grid place-items-center rounded-xl border border-dashed border-border-default bg-bg-surface-sunken p-6 text-center">
      <Icon className="mb-2 size-6 text-fg-tertiary" />
      <p className="font-medium">{title}</p>
      <p className="mt-1 max-w-sm text-sm text-fg-tertiary">{copy}</p>
    </div>
  );
}
