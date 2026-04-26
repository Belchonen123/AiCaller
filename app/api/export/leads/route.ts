import { getCurrentUser } from "@/lib/auth";
import { parseLeadFilters, loadLeadsView } from "@/app/dashboard/leads/query";

function flattenRecord(prefix: string, record: object | null) {
  if (!record) {
    return {};
  }

  return Object.fromEntries(
    Object.entries(record).map(([key, value]) => [
      `${prefix}_${key}`,
      Array.isArray(value) ? value.join("; ") : value,
    ])
  );
}

function toCsv(rows: Record<string, unknown>[]) {
  const headers = Array.from(
    new Set(rows.flatMap((row) => Object.keys(row)))
  );
  const lines = rows.map((row) =>
    headers
      .map((header) => {
        const value = row[header];
        const text = value === null || value === undefined ? "" : String(value);
        return `"${text.replaceAll('"', '""')}"`;
      })
      .join(",")
  );

  return `${headers.join(",")}\n${lines.join("\n")}\n`;
}

export async function GET(request: Request) {
  const currentUser = await getCurrentUser();
  const url = new URL(request.url);
  const params: Record<string, string | undefined> = {};
  url.searchParams.forEach((value, key) => {
    params[key] = value;
  });

  const filters = parseLeadFilters(params);
  const view = await loadLeadsView({
    tenantId: currentUser.profile.tenant_id,
    currentUserId: currentUser.profile.id,
    filters,
  });

  const rows = view.allFilteredItems.map((item) => {
    const {
      primaryContact,
      prospectiveClient,
      caregiverApplicant,
      contactCount,
      callCount,
      flagged,
      profiles,
      ...lead
    } = item;

    return {
      ...flattenRecord("lead", lead),
      lead_flagged: flagged,
      lead_assigned_to_name: profiles?.full_name ?? "",
      ...flattenRecord("primary_contact", primaryContact),
      ...flattenRecord("prospective_client", prospectiveClient),
      ...flattenRecord("caregiver_applicant", caregiverApplicant),
      count_of_contacts: contactCount,
      count_of_calls: callCount,
    };
  });

  return new Response(toCsv(rows), {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": "attachment; filename=\"leads-export.csv\"",
    },
  });
}
