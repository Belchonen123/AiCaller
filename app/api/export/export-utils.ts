import { getCurrentUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export function toCsv(rows: Record<string, unknown>[]) {
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

export function flatten(prefix: string, record: object | null) {
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

export async function requireOwnerForExport(exportType: string) {
  const current = await getCurrentUser();
  if (current.profile.role !== "owner") {
    return null;
  }

  const supabase = await createClient();
  await supabase.from("call_events").insert({
    tenant_id: current.profile.tenant_id,
    event_type: "tenant_export",
    payload: { export_type: exportType },
    created_by: current.profile.id,
  });

  return { current, supabase };
}

export function csvResponse(csv: string, filename: string) {
  return new Response(csv, {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="${filename}"`,
    },
  });
}
