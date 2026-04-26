import type {
  Contact,
  DetailRecord,
  Lead,
} from "@/app/dashboard/leads/[id]/types";

function isPopulated(value: unknown) {
  return value !== null && value !== undefined && value !== "";
}

export function flattenLeadPacket(params: {
  lead: Lead;
  primaryContact: Contact | null;
  prospectiveClient: DetailRecord | null;
  caregiverApplicant: DetailRecord | null;
}) {
  const rows: Record<string, unknown> = {
    ...Object.fromEntries(
      Object.entries(params.lead).map(([key, value]) => [`lead_${key}`, value])
    ),
  };

  if (params.primaryContact) {
    Object.entries(params.primaryContact).forEach(([key, value]) => {
      rows[`primary_contact_${key}`] = value;
    });
  }

  if (params.prospectiveClient) {
    Object.entries(params.prospectiveClient).forEach(([key, value]) => {
      rows[`client_${key}`] = Array.isArray(value) ? value.join("; ") : value;
    });
  }

  if (params.caregiverApplicant) {
    Object.entries(params.caregiverApplicant).forEach(([key, value]) => {
      rows[`caregiver_${key}`] = Array.isArray(value) ? value.join("; ") : value;
    });
  }

  return rows;
}

export function buildPlainTextSummary(params: {
  lead: Lead;
  primaryContact: Contact | null;
  prospectiveClient: DetailRecord | null;
  caregiverApplicant: DetailRecord | null;
}) {
  const flattened = flattenLeadPacket(params);

  return Object.entries(flattened)
    .filter(([, value]) => isPopulated(value))
    .map(([key, value]) => `${key.replaceAll("_", " ")}: ${String(value)}`)
    .join("\n");
}

export function toCsv(rows: Record<string, unknown>) {
  const headers = Object.keys(rows);
  const values = headers.map((header) => {
    const value = rows[header];
    const text = value === null || value === undefined ? "" : String(value);
    return `"${text.replaceAll('"', '""')}"`;
  });

  return `${headers.join(",")}\n${values.join(",")}\n`;
}
