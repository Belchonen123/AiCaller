import { z } from "zod";
import { defaultActiveStatuses } from "@/app/dashboard/leads/list-config";
import {
  caregiverRowSchema,
  clientRowSchema,
  contactRowSchema,
  leadRowSchema,
  staffSchema,
  type LeadFilters,
  type LeadListItem,
} from "@/app/dashboard/leads/types";
import { normalizePhone } from "@/lib/phone";
import { createClient } from "@/lib/supabase/server";

const defaultPageSize = 50;
const pageSizes = [25, 50, 100] as const;
const closedStatuses = ["enrolled", "disqualified", "lost"] as const;

function daysAgo(days: number) {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return date.toISOString().slice(0, 10);
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

function dayRange(day: string) {
  return {
    start: new Date(`${day}T00:00:00.000Z`).toISOString(),
    end: new Date(`${day}T23:59:59.999Z`).toISOString(),
  };
}

function isoDaysAgoStart(days: number) {
  return new Date(`${daysAgo(days)}T00:00:00.000Z`).toISOString();
}

function deltaLabel(current: number, previous: number) {
  const diff = current - previous;
  return diff > 0 ? `+${diff}` : String(diff);
}

function deltaTrend(current: number, previous: number): "up" | "down" | "neutral" {
  if (current > previous) return "up";
  if (current < previous) return "down";
  return "neutral";
}

function rateDeltaLabel(current: number, previous: number) {
  const diff = current - previous;
  return diff > 0 ? `+${diff} pts` : `${diff} pts`;
}

function dateKey(value: string | null | undefined) {
  return value?.slice(0, 10) ?? "";
}

function countByDate<T>(rows: T[], getDate: (row: T) => string | null | undefined, days: string[]) {
  return days.map((day) => rows.filter((row) => dateKey(getDate(row)) === day).length);
}

function splitParam(value: string | string[] | undefined) {
  const raw = Array.isArray(value) ? value.join(",") : value ?? "";
  return raw
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

export function parseLeadFilters(searchParams: Record<string, string | string[] | undefined>): LeadFilters {
  const explicitStatuses = splitParam(searchParams.status);
  const rawStatusMode = Array.isArray(searchParams.view)
    ? searchParams.view[0]
    : searchParams.view;
  const statusMode =
    rawStatusMode === "closed" || rawStatusMode === "all" ? rawStatusMode : "active";
  const rawPageSize = Number(
    Array.isArray(searchParams.pageSize) ? searchParams.pageSize[0] : searchParams.pageSize
  );
  const pageSize = pageSizes.includes(rawPageSize as (typeof pageSizes)[number])
    ? rawPageSize
    : defaultPageSize;

  return {
    leadTypes: splitParam(searchParams.type),
    statuses: explicitStatuses.length
      ? explicitStatuses
      : statusMode === "closed"
        ? [...closedStatuses]
        : statusMode === "all"
          ? []
          : [...defaultActiveStatuses],
    statusMode,
    urgencies: splitParam(searchParams.urgency),
    assignedTo: Array.isArray(searchParams.assigned)
      ? searchParams.assigned[0] ?? "anyone"
      : searchParams.assigned ?? "anyone",
    payers: splitParam(searchParams.payer),
    source: Array.isArray(searchParams.source)
      ? searchParams.source[0] ?? ""
      : searchParams.source ?? "",
    hasFlags: searchParams.flags === "1",
    from: Array.isArray(searchParams.from)
      ? searchParams.from[0] ?? ""
      : searchParams.from ?? "",
    to: Array.isArray(searchParams.to)
      ? searchParams.to[0] ?? ""
      : searchParams.to ?? "",
    search: Array.isArray(searchParams.search)
      ? searchParams.search[0] ?? ""
      : searchParams.search ?? "",
    myLeads: searchParams.my === "1",
    page: Math.max(
      1,
      Number(Array.isArray(searchParams.page) ? searchParams.page[0] : searchParams.page) || 1
    ),
    pageSize,
  };
}

function isActiveStatus(status: string) {
  return !["enrolled", "disqualified", "lost"].includes(status);
}

function adlBurden(client: LeadListItem["prospectiveClient"]) {
  if (!client) {
    return 0;
  }

  return [
    client.adl_bathing,
    client.adl_dressing,
    client.adl_grooming,
    client.adl_toileting,
    client.adl_transferring,
    client.adl_eating,
  ].filter((value) => value === "partial_assist" || value === "total_assist")
    .length;
}

function searchableText(item: LeadListItem) {
  return [
    item.notes,
    item.primaryContact?.full_name,
    item.primaryContact?.phone,
    item.prospectiveClient?.first_name,
    item.prospectiveClient?.last_name,
  ]
    .filter((value): value is string => typeof value === "string")
    .join(" ")
    .toLowerCase();
}

function applyInMemoryFilters(items: LeadListItem[], filters: LeadFilters, currentUserId: string) {
  const normalizedSearchPhone = normalizePhone(filters.search);
  const search = filters.search.trim().toLowerCase();

  return items.filter((item) => {
    if (filters.leadTypes.length && !filters.leadTypes.includes(item.lead_type)) {
      return false;
    }

    if (filters.urgencies.length && (!item.urgency || !filters.urgencies.includes(item.urgency))) {
      return false;
    }

    if (filters.source && item.source !== filters.source) {
      return false;
    }

    if (filters.hasFlags && !item.flagged) {
      return false;
    }

    if (filters.assignedTo === "unassigned" && item.assigned_to) {
      return false;
    }

    if (
      filters.assignedTo !== "anyone" &&
      filters.assignedTo !== "unassigned" &&
      item.assigned_to !== filters.assignedTo
    ) {
      return false;
    }

    if (filters.myLeads && item.assigned_to !== currentUserId) {
      return false;
    }

    if (
      filters.payers.length &&
      (!item.prospectiveClient?.primary_payer ||
        !filters.payers.includes(item.prospectiveClient.primary_payer))
    ) {
      return false;
    }

    if (search) {
      const textMatch = searchableText(item).includes(search);
      const phoneMatch =
        !!normalizedSearchPhone &&
        (item.primaryContact?.phone === normalizedSearchPhone ||
          item.primaryContact?.phone_alt === normalizedSearchPhone);

      if (!textMatch && !phoneMatch) {
        return false;
      }
    }

    return true;
  });
}

function groupByLeadId<T extends { lead_id: string }>(rows: T[]) {
  const map = new Map<string, T[]>();

  rows.forEach((row) => {
    map.set(row.lead_id, [...(map.get(row.lead_id) ?? []), row]);
  });

  return map;
}

export async function loadLeadsView(params: {
  tenantId: string;
  currentUserId: string;
  filters: LeadFilters;
}) {
  const supabase = await createClient();

  let leadQuery = supabase
    .from("leads")
    .select("*, profiles!leads_assigned_to_tenant_fk(id, full_name, email)")
    .eq("tenant_id", params.tenantId)
    .order("last_contact_at", { ascending: false })
    .limit(100);

  if (params.filters.from) {
    leadQuery = leadQuery.gte(
      "last_contact_at",
      new Date(`${params.filters.from}T00:00:00.000Z`).toISOString()
    );
  }

  if (params.filters.to) {
    leadQuery = leadQuery.lte(
      "last_contact_at",
      new Date(`${params.filters.to}T23:59:59.999Z`).toISOString()
    );
  }

  if (params.filters.statuses.length) {
    leadQuery = leadQuery.in("lead_status", params.filters.statuses);
  }

  const [leadsResult, staffResult, totalResult, flagsResult, statsLeadsResult, statsFlagsResult] =
    await Promise.all([
      leadQuery,
      supabase
        .from("profiles")
        .select("id, full_name, email")
        .eq("tenant_id", params.tenantId)
        .order("full_name"),
      supabase
        .from("leads")
        .select("id", { count: "exact", head: true })
        .eq("tenant_id", params.tenantId),
      supabase
        .from("lead_activities")
        .select("lead_id")
        .eq("tenant_id", params.tenantId)
        .eq("activity_type", "flagged")
        .gte("created_at", daysAgo(14)),
      supabase
        .from("leads")
        .select("id, lead_status, created_at, updated_at, next_followup_at")
        .eq("tenant_id", params.tenantId)
        .returns<
          Array<{
            id: string;
            lead_status: string;
            created_at: string | null;
            updated_at: string | null;
            next_followup_at: string | null;
          }>
        >(),
      supabase
        .from("lead_activities")
        .select("lead_id, created_at")
        .eq("tenant_id", params.tenantId)
        .eq("activity_type", "flagged")
        .gte("created_at", isoDaysAgoStart(28))
        .returns<Array<{ lead_id: string; created_at: string | null }>>(),
    ]);

  if (leadsResult.error) {
    throw new Error(`Unable to load leads: ${leadsResult.error.message}`);
  }

  const leads = z.array(leadRowSchema).parse(leadsResult.data ?? []);
  const leadIds = leads.map((lead) => lead.id);
  const flaggedLeadIds = new Set(
    z
      .array(z.object({ lead_id: z.uuid() }))
      .parse(flagsResult.data ?? [])
      .map((row) => row.lead_id)
  );

  const [contactsResult, clientsResult, caregiversResult, callsResult] =
    leadIds.length
      ? await Promise.all([
          supabase
            .from("contacts")
            .select("*")
            .eq("tenant_id", params.tenantId)
            .in("lead_id", leadIds)
            .order("is_primary_contact", { ascending: false })
            .order("created_at", { ascending: false }),
          supabase
            .from("prospective_clients")
            .select("*")
            .eq("tenant_id", params.tenantId)
            .in("lead_id", leadIds),
          supabase
            .from("caregiver_applicants")
            .select("*")
            .eq("tenant_id", params.tenantId)
            .in("lead_id", leadIds),
          supabase
            .from("intake_calls")
            .select("lead_id")
            .eq("tenant_id", params.tenantId)
            .in("lead_id", leadIds),
        ])
      : [
          { data: [] },
          { data: [] },
          { data: [] },
          { data: [] },
        ];

  const contacts = z.array(contactRowSchema).parse(contactsResult.data ?? []);
  const clients = z.array(clientRowSchema).parse(clientsResult.data ?? []);
  const caregivers = z.array(caregiverRowSchema).parse(caregiversResult.data ?? []);
  const callRows = z
    .array(z.object({ lead_id: z.uuid().nullable() }))
    .parse(callsResult.data ?? []);
  const contactsByLead = groupByLeadId(contacts);
  const clientsByLead = new Map(clients.map((client) => [client.lead_id, client]));
  const caregiversByLead = new Map(
    caregivers.map((caregiver) => [caregiver.lead_id, caregiver])
  );
  const callCounts = new Map<string, number>();

  callRows.forEach((row) => {
    if (row.lead_id) {
      callCounts.set(row.lead_id, (callCounts.get(row.lead_id) ?? 0) + 1);
    }
  });

  const items = applyInMemoryFilters(
    leads.map((lead) => {
      const leadContacts = contactsByLead.get(lead.id) ?? [];

      return {
        ...lead,
        primaryContact: leadContacts[0] ?? null,
        prospectiveClient: clientsByLead.get(lead.id) ?? null,
        caregiverApplicant: caregiversByLead.get(lead.id) ?? null,
        contactCount: leadContacts.length,
        callCount: callCounts.get(lead.id) ?? 0,
        flagged: flaggedLeadIds.has(lead.id),
      };
    }),
    params.filters,
    params.currentUserId
  );

  const pagedItems = items.slice(
    (params.filters.page - 1) * params.filters.pageSize,
    params.filters.page * params.filters.pageSize
  );

  const todayRange = dayRange(today());
  const yesterdayRange = dayRange(daysAgo(1));
  const sparklineDays = Array.from({ length: 7 }, (_, index) => daysAgo(6 - index));
  const statsLeads = statsLeadsResult.data ?? [];
  const statsFlags = statsFlagsResult.data ?? [];
  const current7Start = isoDaysAgoStart(7);
  const previous7Start = isoDaysAgoStart(14);
  const current14Start = isoDaysAgoStart(14);
  const previous14Start = isoDaysAgoStart(28);
  const current30Start = isoDaysAgoStart(30);
  const previous30Start = isoDaysAgoStart(60);
  const activeStatsLeads = statsLeads.filter((lead) => isActiveStatus(lead.lead_status));
  const newLeads7Days = statsLeads.filter((lead) => lead.created_at && lead.created_at >= current7Start).length;
  const previousNewLeads7Days = statsLeads.filter(
    (lead) => lead.created_at && lead.created_at >= previous7Start && lead.created_at < current7Start
  ).length;
  const pendingToday = activeStatsLeads.filter(
    (lead) =>
      lead.next_followup_at &&
      lead.next_followup_at >= todayRange.start &&
      lead.next_followup_at <= todayRange.end
  ).length;
  const pendingYesterday = activeStatsLeads.filter(
    (lead) =>
      lead.next_followup_at &&
      lead.next_followup_at >= yesterdayRange.start &&
      lead.next_followup_at <= yesterdayRange.end
  ).length;
  const overdue = activeStatsLeads.filter(
    (lead) => lead.next_followup_at && lead.next_followup_at < todayRange.start
  ).length;
  const flagged14Days = new Set(
    statsFlags
      .filter((row) => row.created_at && row.created_at >= current14Start)
      .map((row) => row.lead_id)
  ).size;
  const previousFlagged14Days = new Set(
    statsFlags
      .filter(
        (row) =>
          row.created_at &&
          row.created_at >= previous14Start &&
          row.created_at < current14Start
      )
      .map((row) => row.lead_id)
  ).size;
  const currentConversionRows = statsLeads.filter(
    (lead) =>
      lead.updated_at &&
      lead.updated_at >= current30Start &&
      closedStatuses.includes(lead.lead_status as (typeof closedStatuses)[number])
  );
  const previousConversionRows = statsLeads.filter(
    (lead) =>
      lead.updated_at &&
      lead.updated_at >= previous30Start &&
      lead.updated_at < current30Start &&
      closedStatuses.includes(lead.lead_status as (typeof closedStatuses)[number])
  );
  const conversionRate =
    currentConversionRows.length === 0
      ? 0
      : Math.round(
          (currentConversionRows.filter((lead) => lead.lead_status === "enrolled").length /
            currentConversionRows.length) *
            100
        );
  const previousConversionRate =
    previousConversionRows.length === 0
      ? 0
      : Math.round(
          (previousConversionRows.filter((lead) => lead.lead_status === "enrolled").length /
            previousConversionRows.length) *
            100
        );

  return {
    items: pagedItems,
    allFilteredItems: items,
    staff: z.array(staffSchema).parse(staffResult.data ?? []),
    hasAnyLeads: (totalResult.count ?? 0) > 0,
    pageSize: params.filters.pageSize,
    totalFiltered: items.length,
    stats: {
      newLeads7Days,
      newLeadsDelta: deltaLabel(newLeads7Days, previousNewLeads7Days),
      newLeadsTrend: deltaTrend(newLeads7Days, previousNewLeads7Days),
      newLeadSparkline7Days: countByDate(statsLeads, (lead) => lead.created_at, sparklineDays),
      pendingToday,
      pendingTodayDelta: deltaLabel(pendingToday, pendingYesterday),
      pendingTodayTrend: deltaTrend(pendingToday, pendingYesterday),
      pendingTodaySparkline7Days: countByDate(
        activeStatsLeads,
        (lead) => lead.next_followup_at,
        sparklineDays
      ),
      overdue,
      overdueSparkline: [overdue, overdue],
      flagged14Days,
      flagged14DaysDelta: deltaLabel(flagged14Days, previousFlagged14Days),
      flagged14DaysTrend: deltaTrend(flagged14Days, previousFlagged14Days),
      flaggedSparkline14Days: countByDate(statsFlags, (row) => row.created_at, sparklineDays),
      conversionRate,
      conversionRateDelta: rateDeltaLabel(conversionRate, previousConversionRate),
      conversionRateTrend: deltaTrend(conversionRate, previousConversionRate),
      conversionRateSparkline: [previousConversionRate, conversionRate],
    },
    helpers: {
      adlBurden,
    },
  };
}
