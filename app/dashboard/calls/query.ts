import { z } from "zod";
import {
  callEventSchema,
  callRowSchema,
  relatedLeadSchema,
  type CallFilters,
} from "@/app/dashboard/calls/types";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

function daysAgo(days: number) {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return date.toISOString().slice(0, 10);
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

function splitParam(value: string | string[] | undefined) {
  const raw = Array.isArray(value) ? value.join(",") : value ?? "";
  return raw
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

export function parseCallFilters(params: Record<string, string | string[] | undefined>): CallFilters {
  const get = (key: string, fallback: string) =>
    Array.isArray(params[key]) ? params[key][0] ?? fallback : params[key] ?? fallback;

  return {
    status: get("status", "all"),
    confidence: splitParam(params.confidence).join(",") || "all",
    linked: get("linked", "all"),
    direction: get("direction", "all"),
    search: get("search", ""),
    from: get("from", daysAgo(60)),
    to: get("to", today()),
  };
}

export async function loadCallsList(params: {
  tenantId: string;
  filters: CallFilters;
}) {
  const supabase = await createClient();
  const fromIso = new Date(`${params.filters.from}T00:00:00.000Z`).toISOString();
  const toIso = new Date(`${params.filters.to}T23:59:59.999Z`).toISOString();

  let query = supabase
    .from("intake_calls")
    .select("*, leads!intake_calls_lead_tenant_fk(id, lead_type, lead_status)")
    .eq("tenant_id", params.tenantId)
    .gte("created_at", fromIso)
    .lte("created_at", toIso)
    .order("created_at", { ascending: false })
    .limit(100);

  if (params.filters.status !== "all") {
    query = query.eq("status", params.filters.status);
  }

  if (params.filters.confidence !== "all") {
    query = query.in("extraction_confidence", params.filters.confidence.split(","));
  }

  if (params.filters.linked === "linked") {
    query = query.not("lead_id", "is", null);
  }

  if (params.filters.linked === "unlinked") {
    query = query.is("lead_id", null);
  }

  if (params.filters.direction !== "all") {
    query = query.eq("call_direction", params.filters.direction);
  }

  if (params.filters.search) {
    query = query.or(
      `caller_phone.ilike.%${params.filters.search}%,caller_phone_normalized.ilike.%${params.filters.search}%,retell_call_id.ilike.%${params.filters.search}%`
    );
  }

  const { data } = await query;

  return z.array(callRowSchema).parse(data ?? []);
}

export async function loadCallDetail(params: {
  tenantId: string;
  callId: string;
}) {
  const [callResult, eventsResult, leadsResult] = await Promise.all([
    supabaseAdmin
      .from("intake_calls")
      .select("*, leads!intake_calls_lead_tenant_fk(id, lead_type, lead_status)")
      .eq("tenant_id", params.tenantId)
      .eq("id", params.callId)
      .single(),
    supabaseAdmin
      .from("call_events")
      .select("id, event_type, payload, created_at, profiles!call_events_created_by_tenant_fk(full_name, email)")
      .eq("tenant_id", params.tenantId)
      .eq("call_id", params.callId)
      .order("created_at", { ascending: false }),
    supabaseAdmin
      .from("leads")
      .select("id, lead_type, lead_status, created_at")
      .eq("tenant_id", params.tenantId)
      .order("created_at", { ascending: false })
      .limit(100),
  ]);

  if (callResult.error || !callResult.data) {
    return null;
  }

  return {
    call: callRowSchema.parse(callResult.data),
    events: z.array(callEventSchema).parse(eventsResult.data ?? []),
    relatedLeads: z.array(relatedLeadSchema).parse(leadsResult.data ?? []),
  };
}
