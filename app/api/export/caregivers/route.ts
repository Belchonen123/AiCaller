import { getCurrentUser } from "@/lib/auth";
import {
  loadCaregiverApplicants,
  parseCaregiverFilters,
} from "@/app/dashboard/caregivers/query";

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
  const headers = Array.from(new Set(rows.flatMap((row) => Object.keys(row))));
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

  const applicants = await loadCaregiverApplicants({
    tenantId: currentUser.profile.tenant_id,
    filters: parseCaregiverFilters(params),
  });

  const rows = applicants.map((applicant) => {
    const { leads, ...caregiver } = applicant;

    return {
      ...flattenRecord("caregiver_applicant", caregiver),
      ...flattenRecord("lead", leads ?? null),
    };
  });

  return new Response(toCsv(rows), {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": "attachment; filename=\"caregivers-export.csv\"",
    },
  });
}
