import { notFound } from "next/navigation";
import { z } from "zod";
import {
  contactSchema,
  leadSchema,
  recordSchema,
} from "@/app/dashboard/leads/[id]/types";
import { flattenLeadPacket, toCsv } from "@/app/dashboard/leads/[id]/summary";
import { getCurrentUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

type RouteProps = {
  params: Promise<{
    id: string;
  }>;
};

const paramsSchema = z.object({
  id: z.uuid(),
});

export async function GET(_request: Request, { params }: RouteProps) {
  const parsed = paramsSchema.safeParse(await params);

  if (!parsed.success) {
    notFound();
  }

  const { profile } = await getCurrentUser();
  const supabase = await createClient();
  const [leadResult, contactResult, clientResult, caregiverResult] =
    await Promise.all([
      supabase
        .from("leads")
        .select("*")
        .eq("id", parsed.data.id)
        .eq("tenant_id", profile.tenant_id)
        .single(),
      supabase
        .from("contacts")
        .select("*")
        .eq("lead_id", parsed.data.id)
        .eq("tenant_id", profile.tenant_id)
        .order("is_primary_contact", { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabase
        .from("prospective_clients")
        .select("*")
        .eq("lead_id", parsed.data.id)
        .eq("tenant_id", profile.tenant_id)
        .maybeSingle(),
      supabase
        .from("caregiver_applicants")
        .select("*")
        .eq("lead_id", parsed.data.id)
        .eq("tenant_id", profile.tenant_id)
        .maybeSingle(),
    ]);

  if (leadResult.error || !leadResult.data) {
    notFound();
  }

  const csv = toCsv(
    flattenLeadPacket({
      lead: leadSchema.parse(leadResult.data),
      primaryContact: contactResult.data
        ? contactSchema.parse(contactResult.data)
        : null,
      prospectiveClient: recordSchema.parse(clientResult.data),
      caregiverApplicant: recordSchema.parse(caregiverResult.data),
    })
  );

  return new Response(csv, {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="lead-${parsed.data.id}-intake.csv"`,
    },
  });
}
