import "server-only";

import { syncTerminalInProgressTasks } from "@/lib/retell/dispatcher";
import { supabaseAdmin } from "@/lib/supabase/admin";

type DashboardLeadRow = {
  id: string;
  lead_type: string;
  lead_status: string;
  urgency: string | null;
  next_followup_at: string | null;
  last_contact_at: string | null;
  created_at: string | null;
  notes: string | null;
  profiles?: {
    full_name: string | null;
    email: string | null;
  } | null;
};

type DashboardContactRow = {
  lead_id: string;
  full_name: string | null;
  phone: string | null;
  is_primary_contact: boolean | null;
  created_at: string | null;
};

type DashboardClientRow = {
  lead_id: string;
  first_name: string | null;
  last_name: string | null;
  primary_payer: string | null;
};

type DashboardCallRow = {
  id: string;
  caller_phone: string | null;
  call_started_at: string | null;
  created_at: string | null;
  status: string;
  call_direction: string | null;
  lead_id: string | null;
};

type DashboardCampaignRow = {
  id: string;
  tenant_id: string;
  name: string;
  status: string;
  purpose: string;
  agent_id: string;
  from_phone: string;
  script_variables: Record<string, unknown> | null;
  max_concurrent: number;
  max_attempts_per_task: number;
  retry_delay_minutes: number;
  call_window_start: string | null;
  call_window_end: string | null;
  call_window_timezone: string | null;
  started_at: string | null;
  completed_at: string | null;
  updated_at: string | null;
  created_at: string | null;
};

type DashboardTaskRow = {
  status: string;
};

export type DashboardLeadItem = DashboardLeadRow & {
  displayName: string;
  primaryPhone: string | null;
  payer: string | null;
  assigneeName: string | null;
};

export type DashboardOverview = {
  stats: {
    todayIntakes: number;
    callsInProgress: number;
    urgentLeads: number;
    followupsDueToday: number;
  };
  todayLeads: DashboardLeadItem[];
  urgentLeads: DashboardLeadItem[];
  followupsDue: DashboardLeadItem[];
  liveCalls: DashboardCallRow[];
  lastCampaign: (DashboardCampaignRow & {
    taskCounts: {
      total: number;
      queued: number;
      inProgress: number;
      completed: number;
      failed: number;
    };
  }) | null;
};

const closedStatuses = new Set(["enrolled", "disqualified", "lost"]);

function todayRange() {
  const today = new Date().toISOString().slice(0, 10);

  return {
    start: new Date(`${today}T00:00:00.000Z`).toISOString(),
    end: new Date(`${today}T23:59:59.999Z`).toISOString(),
  };
}

function isActiveLead(lead: DashboardLeadRow) {
  return !closedStatuses.has(lead.lead_status);
}

function leadDisplayName(
  lead: DashboardLeadRow,
  contactsByLead: Map<string, DashboardContactRow>,
  clientsByLead: Map<string, DashboardClientRow>
) {
  const client = clientsByLead.get(lead.id);
  const clientName = [client?.first_name, client?.last_name].filter(Boolean).join(" ").trim();

  return clientName || contactsByLead.get(lead.id)?.full_name || "Unnamed lead";
}

async function enrichLeads(leads: DashboardLeadRow[]): Promise<DashboardLeadItem[]> {
  const leadIds = leads.map((lead) => lead.id);

  if (leadIds.length === 0) {
    return [];
  }

  const [contactsResult, clientsResult] = await Promise.all([
    supabaseAdmin
      .from("contacts")
      .select("lead_id, full_name, phone, is_primary_contact, created_at")
      .in("lead_id", leadIds)
      .order("is_primary_contact", { ascending: false })
      .order("created_at", { ascending: false })
      .returns<DashboardContactRow[]>(),
    supabaseAdmin
      .from("prospective_clients")
      .select("lead_id, first_name, last_name, primary_payer")
      .in("lead_id", leadIds)
      .returns<DashboardClientRow[]>(),
  ]);
  const contactsByLead = new Map<string, DashboardContactRow>();
  const clientsByLead = new Map<string, DashboardClientRow>();

  for (const contact of contactsResult.data ?? []) {
    if (!contactsByLead.has(contact.lead_id)) {
      contactsByLead.set(contact.lead_id, contact);
    }
  }

  for (const client of clientsResult.data ?? []) {
    clientsByLead.set(client.lead_id, client);
  }

  return leads.map((lead) => {
    const primaryContact = contactsByLead.get(lead.id);
    const client = clientsByLead.get(lead.id);

    return {
      ...lead,
      displayName: leadDisplayName(lead, contactsByLead, clientsByLead),
      primaryPhone: primaryContact?.phone ?? null,
      payer: client?.primary_payer ?? null,
      assigneeName: lead.profiles?.full_name ?? lead.profiles?.email ?? null,
    };
  });
}

export async function loadDashboardOverview(tenantId: string): Promise<DashboardOverview> {
  const { start, end } = todayRange();

  const [
    todayLeadsResult,
    liveCallsResult,
    urgentLeadsResult,
    followupsResult,
    lastCampaignResult,
  ] = await Promise.all([
    supabaseAdmin
      .from("leads")
      .select("id, lead_type, lead_status, urgency, next_followup_at, last_contact_at, created_at, notes, profiles!leads_assigned_to_tenant_fk(full_name, email)")
      .eq("tenant_id", tenantId)
      .gte("created_at", start)
      .lte("created_at", end)
      .order("created_at", { ascending: false })
      .limit(5)
      .returns<DashboardLeadRow[]>(),
    supabaseAdmin
      .from("intake_calls")
      .select("id, caller_phone, call_started_at, created_at, status, call_direction, lead_id")
      .eq("tenant_id", tenantId)
      .not("call_started_at", "is", null)
      .is("call_ended_at", null)
      .order("call_started_at", { ascending: false })
      .limit(5)
      .returns<DashboardCallRow[]>(),
    supabaseAdmin
      .from("leads")
      .select("id, lead_type, lead_status, urgency, next_followup_at, last_contact_at, created_at, notes, profiles!leads_assigned_to_tenant_fk(full_name, email)")
      .eq("tenant_id", tenantId)
      .in("urgency", ["emergent", "urgent"])
      .order("last_contact_at", { ascending: false })
      .limit(10)
      .returns<DashboardLeadRow[]>(),
    supabaseAdmin
      .from("leads")
      .select("id, lead_type, lead_status, urgency, next_followup_at, last_contact_at, created_at, notes, profiles!leads_assigned_to_tenant_fk(full_name, email)")
      .eq("tenant_id", tenantId)
      .not("next_followup_at", "is", null)
      .lte("next_followup_at", end)
      .order("next_followup_at", { ascending: true })
      .limit(10)
      .returns<DashboardLeadRow[]>(),
    supabaseAdmin
      .from("campaigns")
      .select("id, tenant_id, name, status, purpose, agent_id, from_phone, script_variables, max_concurrent, max_attempts_per_task, retry_delay_minutes, call_window_start, call_window_end, call_window_timezone, started_at, completed_at, updated_at, created_at")
      .eq("tenant_id", tenantId)
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle<DashboardCampaignRow>(),
  ]);
  const todayLeads = todayLeadsResult.data ?? [];
  const liveCalls = liveCallsResult.data ?? [];
  const urgentLeads = (urgentLeadsResult.data ?? []).filter(isActiveLead).slice(0, 5);
  const followupsDue = (followupsResult.data ?? []).filter(isActiveLead).slice(0, 5);
  const lastCampaign = lastCampaignResult.data ?? null;
  if (lastCampaign?.status === "running") {
    await syncTerminalInProgressTasks(tenantId, lastCampaign);
  }

  const taskRows = lastCampaign
    ? (
        await supabaseAdmin
          .from("call_tasks")
          .select("status")
          .eq("tenant_id", tenantId)
          .eq("campaign_id", lastCampaign.id)
          .returns<DashboardTaskRow[]>()
      ).data ?? []
    : [];

  return {
    stats: {
      todayIntakes: todayLeads.length,
      callsInProgress: liveCalls.length,
      urgentLeads: urgentLeads.length,
      followupsDueToday: followupsDue.length,
    },
    todayLeads: await enrichLeads(todayLeads),
    urgentLeads: await enrichLeads(urgentLeads),
    followupsDue: await enrichLeads(followupsDue),
    liveCalls,
    lastCampaign: lastCampaign
      ? {
          ...lastCampaign,
          taskCounts: {
            total: taskRows.length,
            queued: taskRows.filter((task) => ["queued", "scheduled"].includes(task.status)).length,
            inProgress: taskRows.filter((task) => task.status === "in_progress").length,
            completed: taskRows.filter((task) => task.status === "completed").length,
            failed: taskRows.filter((task) => ["failed", "no_answer", "busy"].includes(task.status)).length,
          },
        }
      : null,
  };
}
