import { csvResponse, flatten, requireOwnerForExport, toCsv } from "@/app/api/export/export-utils";

export async function GET() {
  const context = await requireOwnerForExport("all_leads");
  if (!context) {
    return Response.json({ error: "forbidden" }, { status: 403 });
  }

  const { current, supabase } = context;
  const [leads, contacts, clients, caregivers] = await Promise.all([
    supabase.from("leads").select("*").eq("tenant_id", current.profile.tenant_id),
    supabase.from("contacts").select("*").eq("tenant_id", current.profile.tenant_id),
    supabase.from("prospective_clients").select("*").eq("tenant_id", current.profile.tenant_id),
    supabase.from("caregiver_applicants").select("*").eq("tenant_id", current.profile.tenant_id),
  ]);
  const contactRows = contacts.data ?? [];
  const clientRows = clients.data ?? [];
  const caregiverRows = caregivers.data ?? [];
  const rows = (leads.data ?? []).map((lead) => ({
    ...flatten("lead", lead),
    ...flatten(
      "primary_contact",
      contactRows.find((contact) => contact.lead_id === lead.id && contact.is_primary_contact) ??
        contactRows.find((contact) => contact.lead_id === lead.id) ??
        null
    ),
    ...flatten("prospective_client", clientRows.find((client) => client.lead_id === lead.id) ?? null),
    ...flatten("caregiver_applicant", caregiverRows.find((caregiver) => caregiver.lead_id === lead.id) ?? null),
  }));

  return csvResponse(toCsv(rows), "all-leads.csv");
}
