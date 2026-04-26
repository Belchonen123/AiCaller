import { LeadsFilterBar, SavedViewsMenu } from "@/app/dashboard/leads/filters";
import { LeadListClient } from "@/app/dashboard/leads/lead-list-client";
import { ManualLeadDialog } from "@/app/dashboard/leads/manual-lead-dialog";
import { parseLeadFilters, loadLeadsView } from "@/app/dashboard/leads/query";
import { PageHeader } from "@/components/page-header";
import { MotionItem, MotionList } from "@/components/motion-list";
import { StatCard } from "@/components/stat-card";
import { Button } from "@/components/ui/button";
import { getCurrentUser } from "@/lib/auth";

type LeadsPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function LeadsPage({ searchParams }: LeadsPageProps) {
  const currentUser = await getCurrentUser();
  const rawSearchParams = await searchParams;
  const filters = parseLeadFilters(rawSearchParams);
  const view = await loadLeadsView({
    tenantId: currentUser.profile.tenant_id,
    currentUserId: currentUser.profile.id,
    filters,
  });
  const exportHref = `/api/export/leads?${new URLSearchParams(
    Object.entries(rawSearchParams).flatMap(([key, value]) =>
      Array.isArray(value) ? value.map((item) => [key, item]) : [[key, value ?? ""]]
    )
  ).toString()}`;
  const totalPages = Math.max(1, Math.ceil(view.totalFiltered / view.pageSize));

  return (
    <div className="grid gap-4">
      <PageHeader
        eyebrow="Operations / Lead pipeline"
        title="Leads"
        description="All callers and referrals across active and archived statuses."
        actions={
          <>
            <ManualLeadDialog triggerLabel="New manual lead" triggerVariant="secondary" />
            <Button variant="secondary" render={<a href={exportHref} />}>
              Export CSV
            </Button>
            <SavedViewsMenu />
          </>
        }
      />

      <MotionList as="section" className="grid gap-3 md:grid-cols-5">
        <MotionItem>
          <StatCard
            label="New leads"
            value={view.stats.newLeads7Days}
            delta={view.stats.newLeadsDelta}
            trend={view.stats.newLeadsTrend}
            sparkline={view.stats.newLeadSparkline7Days}
          />
        </MotionItem>
        <MotionItem>
          <StatCard
            label="Pending follow-up today"
            value={view.stats.pendingToday}
            delta={view.stats.pendingTodayDelta}
            trend={view.stats.pendingTodayTrend}
            comparisonLabel="vs yesterday"
            tone={view.stats.pendingToday > 0 ? "danger" : "default"}
            valueClassName={view.stats.pendingToday > 0 ? "text-danger-fg" : undefined}
            sparkline={view.stats.pendingTodaySparkline7Days}
          />
        </MotionItem>
        <MotionItem>
          <StatCard
            label="Overdue follow-ups"
            value={view.stats.overdue}
            comparisonLabel="current snapshot"
            tone={view.stats.overdue > 0 ? "danger" : "default"}
            sparkline={view.stats.overdueSparkline}
          />
        </MotionItem>
        <MotionItem>
          <StatCard
            label="Flagged / red-flag leads"
            value={view.stats.flagged14Days}
            delta={view.stats.flagged14DaysDelta}
            trend={view.stats.flagged14DaysTrend}
            comparisonLabel="vs prior 14d"
            tone={view.stats.flagged14Days > 0 ? "warning" : "default"}
            sparkline={view.stats.flaggedSparkline14Days}
          />
        </MotionItem>
        <MotionItem>
          <StatCard
            label="Conversion rate"
            value={`${view.stats.conversionRate}%`}
            delta={view.stats.conversionRateDelta}
            trend={view.stats.conversionRateTrend}
            comparisonLabel="vs prior 30d"
            sparkline={view.stats.conversionRateSparkline}
          />
        </MotionItem>
      </MotionList>

      <LeadsFilterBar filters={filters} staff={view.staff} />

      <LeadListClient
        items={view.items}
        filters={filters}
        rawSearchParams={rawSearchParams}
        totalFiltered={view.totalFiltered}
        totalPages={totalPages}
        hasAnyLeads={view.hasAnyLeads}
      />
    </div>
  );
}
