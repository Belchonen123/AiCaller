import { notFound } from "next/navigation";
import { z } from "zod";
import { LeadDetailClient } from "@/app/dashboard/leads/[id]/lead-detail-client";
import {
  activitySchema,
  contactSchema,
  intakeCallSchema,
  leadSchema,
  profileOptionSchema,
  recordSchema,
  type LeadDetailData,
} from "@/app/dashboard/leads/[id]/types";
import { getCurrentUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

type PageProps = {
  params: Promise<{
    id: string;
  }>;
};

const paramsSchema = z.object({
  id: z.uuid(),
});

function asArray<T>(value: unknown, schema: z.ZodType<T>) {
  const parsed = z.array(schema).safeParse(value);
  return parsed.success ? parsed.data : [];
}

function asRecord(value: unknown) {
  return recordSchema.parse(value);
}

export default async function LeadDetailPage({ params }: PageProps) {
  const parsedParams = paramsSchema.safeParse(await params);

  if (!parsedParams.success) {
    notFound();
  }

  const { profile } = await getCurrentUser();
  const supabase = await createClient();

  const { data: leadData, error: leadError } = await supabase
    .from("leads")
    .select("*")
    .eq("id", parsedParams.data.id)
    .eq("tenant_id", profile.tenant_id)
    .single();

  if (leadError || !leadData) {
    notFound();
  }

  const [
    staffResult,
    clientResult,
    caregiverResult,
    contactsResult,
    callsResult,
    activitiesResult,
    flagsResult,
    relatedLeadsResult,
  ] = await Promise.all([
    supabase
      .from("profiles")
      .select("id, full_name, email, role")
      .eq("tenant_id", profile.tenant_id)
      .order("full_name"),
    supabase
      .from("prospective_clients")
      .select("*")
      .eq("lead_id", parsedParams.data.id)
      .eq("tenant_id", profile.tenant_id)
      .maybeSingle(),
    supabase
      .from("caregiver_applicants")
      .select("*")
      .eq("lead_id", parsedParams.data.id)
      .eq("tenant_id", profile.tenant_id)
      .maybeSingle(),
    supabase
      .from("contacts")
      .select("*")
      .eq("lead_id", parsedParams.data.id)
      .eq("tenant_id", profile.tenant_id)
      .order("is_primary_contact", { ascending: false }),
    supabase
      .from("intake_calls")
      .select("id, retell_call_id, call_started_at, call_ended_at, duration_seconds, transcript, recording_url, extraction, extraction_confidence, created_at")
      .eq("lead_id", parsedParams.data.id)
      .eq("tenant_id", profile.tenant_id)
      .order("created_at", { ascending: false }),
    supabase
      .from("lead_activities")
      .select("id, activity_type, summary, detail, created_at, profiles(full_name, email)")
      .eq("lead_id", parsedParams.data.id)
      .eq("tenant_id", profile.tenant_id)
      .order("created_at", { ascending: false })
      .limit(50),
    supabase
      .from("lead_activities")
      .select("id, activity_type, summary, detail, created_at, profiles(full_name, email)")
      .eq("lead_id", parsedParams.data.id)
      .eq("tenant_id", profile.tenant_id)
      .eq("activity_type", "flagged")
      .order("created_at", { ascending: false })
      .limit(10),
    supabase
      .from("leads")
      .select("id, lead_type, lead_status, created_at")
      .eq("tenant_id", profile.tenant_id)
      .order("created_at", { ascending: false })
      .limit(100),
  ]);

  const data: LeadDetailData = {
    lead: leadSchema.parse(leadData),
    staff: asArray(staffResult.data, profileOptionSchema),
    prospectiveClient: asRecord(clientResult.data),
    caregiverApplicant: asRecord(caregiverResult.data),
    contacts: asArray(contactsResult.data, contactSchema),
    calls: asArray(callsResult.data, intakeCallSchema),
    activities: asArray(activitiesResult.data, activitySchema),
    flags: asArray(flagsResult.data, activitySchema),
    relatedLeads: asArray(
      relatedLeadsResult.data,
      leadSchema.pick({
        id: true,
        lead_type: true,
        lead_status: true,
        created_at: true,
      })
    ),
  };

  return <LeadDetailClient data={data} />;
}
