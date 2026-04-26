import { CallsListClient } from "@/app/dashboard/calls/calls-list-client";
import { CallsFilterBar } from "@/app/dashboard/calls/filters";
import { loadCallsList, parseCallFilters } from "@/app/dashboard/calls/query";
import { PageHeader } from "@/components/page-header";
import { Card } from "@/components/ui/card";
import { getCurrentUser } from "@/lib/auth";
import { formatDuration, formatPercent } from "@/lib/formatters";

type CallsPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function CallsPage({ searchParams }: CallsPageProps) {
  const currentUser = await getCurrentUser();
  const filters = parseCallFilters(await searchParams);
  const calls = await loadCallsList({
    tenantId: currentUser.profile.tenant_id,
    filters,
  });
  const todayKey = new Date().toISOString().slice(0, 10);
  const callsToday = calls.filter((call) => call.created_at?.startsWith(todayKey));
  const completedDurations = calls
    .map((call) => call.duration_seconds)
    .filter((duration): duration is number => typeof duration === "number" && duration > 0);
  const extractedCalls = calls.filter((call) => Boolean(call.extraction));
  const pickupRate = calls.length
    ? calls.filter((call) => call.duration_seconds && call.duration_seconds > 15).length / calls.length
    : 0;
  const extractionRate = calls.length ? extractedCalls.length / calls.length : 0;

  return (
    <div className="grid gap-5">
      <PageHeader
        eyebrow="Operations"
        title="Calls"
        description="Review inbound Retell calls, extraction status, and linked leads."
      />
      <section className="grid gap-3 md:grid-cols-4">
        <CallStat label="Total calls today" value={callsToday.length} />
        <CallStat
          label="Avg duration"
          value={formatDuration(
            completedDurations.length
              ? Math.round(
                  completedDurations.reduce((sum, duration) => sum + duration, 0) /
                    completedDurations.length
                )
              : 0
          )}
        />
        <CallStat label="Pickup rate" value={calls.length ? formatPercent(pickupRate) : "Placeholder"} />
        <CallStat label="Extraction success" value={calls.length ? formatPercent(extractionRate) : "0%"} />
      </section>
      <CallsFilterBar filters={filters} />
      <CallsListClient calls={calls} />
    </div>
  );
}

function CallStat({ label, value }: { label: string; value: string | number }) {
  return (
    <Card elevation="raised" padding="compact">
      <p className="text-xs font-medium tracking-wide text-fg-tertiary uppercase">{label}</p>
      <p className="mt-1 text-2xl font-semibold tabular-nums text-fg-primary">{value}</p>
    </Card>
  );
}
