import { redirect } from "next/navigation";
import { z } from "zod";
import { SettingsClient } from "@/app/dashboard/settings/settings-client";
import { PageHeader } from "@/components/page-header";
import { getCurrentUser } from "@/lib/auth";
import { listAgents, listPhoneNumbers } from "@/lib/retell/client";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

const staffSchema = z.object({
  id: z.uuid(),
  full_name: z.string().nullable(),
  email: z.string(),
  role: z.string(),
});

const retellStatusSchema = z
  .object({
    agent_name: z.string().nullable().optional(),
    agentName: z.string().nullable().optional(),
    name: z.string().nullable().optional(),
    phone_number: z.string().nullable().optional(),
    phoneNumber: z.string().nullable().optional(),
  })
  .passthrough();

async function loadRetellStatus() {
  const agentId = process.env.RETELL_AGENT_ID;
  const apiKey = process.env.RETELL_API_KEY;

  if (!agentId || !apiKey) {
    return {
      configured: false,
      reachable: false,
      agentName: null,
      phoneNumber: null,
    };
  }

  try {
    const response = await fetch(`https://api.retellai.com/get-agent/${agentId}`, {
      headers: { Authorization: `Bearer ${apiKey}` },
      next: { revalidate: 300 },
    });

    if (!response.ok) {
      return { configured: true, reachable: false, agentName: null, phoneNumber: null };
    }

    const parsed = retellStatusSchema.safeParse(await response.json());
    if (!parsed.success) {
      return { configured: true, reachable: true, agentName: agentId, phoneNumber: null };
    }

    return {
      configured: true,
      reachable: true,
      agentName:
        parsed.data.agent_name ?? parsed.data.agentName ?? parsed.data.name ?? agentId,
      phoneNumber: parsed.data.phone_number ?? parsed.data.phoneNumber ?? null,
    };
  } catch {
    return { configured: true, reachable: false, agentName: null, phoneNumber: null };
  }
}

async function loadOutboundCalling(tenantId: string) {
  const [phoneNumbersResult, agentsResult, runningCampaigns, queuedTasks, inProgressTasks, lastDispatch] =
    await Promise.all([
      listPhoneNumbers().catch(() => []),
      listAgents().catch(() => []),
      supabaseAdmin
        .from("campaigns")
        .select("id", { count: "exact", head: true })
        .eq("tenant_id", tenantId)
        .eq("status", "running"),
      supabaseAdmin
        .from("call_tasks")
        .select("id", { count: "exact", head: true })
        .eq("tenant_id", tenantId)
        .in("status", ["queued", "scheduled"]),
      supabaseAdmin
        .from("call_tasks")
        .select("id", { count: "exact", head: true })
        .eq("tenant_id", tenantId)
        .eq("status", "in_progress"),
      supabaseAdmin
        .from("call_events")
        .select("created_at")
        .eq("tenant_id", tenantId)
        .eq("event_type", "outbound_dispatched")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle<{ created_at: string | null }>(),
    ]);

  return {
    retellAgentId: process.env.RETELL_AGENT_ID ?? null,
    phoneNumbers: phoneNumbersResult,
    agents: agentsResult,
    dispatcher: {
      active: (runningCampaigns.count ?? 0) > 0,
      queuedTasks: queuedTasks.count ?? 0,
      inProgressTasks: inProgressTasks.count ?? 0,
      lastRunAt: lastDispatch.data?.created_at ?? null,
    },
  };
}

export default async function SettingsPage() {
  const current = await getCurrentUser();
  if (!["owner", "admin"].includes(current.profile.role)) {
    redirect("/dashboard/leads");
  }

  const supabase = await createClient();
  const { data } = await supabase
    .from("profiles")
    .select("id, full_name, email, role")
    .eq("tenant_id", current.profile.tenant_id)
    .order("email");
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://[your-vercel-domain]";
  const outboundCalling = await loadOutboundCalling(current.profile.tenant_id);

  return (
    <div className="grid gap-4">
      <PageHeader
        eyebrow="Configuration"
        title="Settings"
        description="Agency, staff, Retell, outbound calling, compliance, and tenant controls."
      />
      <SettingsClient
        tenant={current.tenant}
        staff={z.array(staffSchema).parse(data ?? [])}
        currentRole={current.profile.role}
        webhookUrl={`${appUrl}/api/retell/webhook`}
        retellStatus={await loadRetellStatus()}
        outboundCalling={outboundCalling}
      />
    </div>
  );
}
