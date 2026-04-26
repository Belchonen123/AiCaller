import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase/admin";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{
    id: string;
    batchId: string;
  }>;
};

type RejectedRow = {
  row_number?: number;
  raw_row?: Record<string, unknown>;
  reason?: string;
};

function csvEscape(value: unknown) {
  const text = value === null || value === undefined ? "" : String(value);
  return `"${text.replaceAll('"', '""')}"`;
}

function rejectedRowsToCsv(rows: RejectedRow[]) {
  const lines = [
    ["row_number", "reason", "raw_row"].map(csvEscape).join(","),
    ...rows.map((row) =>
      [
        row.row_number ?? "",
        row.reason ?? "",
        JSON.stringify(row.raw_row ?? {}),
      ]
        .map(csvEscape)
        .join(",")
    ),
  ];

  return lines.join("\n");
}

export async function GET(_request: Request, context: RouteContext) {
  const current = await getCurrentUser().catch(() => null);
  if (!current) {
    return new Response(null, { status: 401 });
  }

  const parsed = z
    .object({
      id: z.string().uuid(),
      batchId: z.string().uuid(),
    })
    .safeParse(await context.params);

  if (!parsed.success) {
    return new Response(null, { status: 404 });
  }

  const { data, error } = await supabaseAdmin
    .from("call_upload_batches")
    .select("id, rejected_rows")
    .eq("tenant_id", current.profile.tenant_id)
    .eq("campaign_id", parsed.data.id)
    .eq("id", parsed.data.batchId)
    .single<{ id: string; rejected_rows: RejectedRow[] | null }>();

  if (error || !data) {
    return new Response(null, { status: 404 });
  }

  return new Response(rejectedRowsToCsv(data.rejected_rows ?? []), {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="rejected-rows-${data.id}.csv"`,
    },
  });
}
