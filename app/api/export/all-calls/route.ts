import { csvResponse, flatten, requireOwnerForExport, toCsv } from "@/app/api/export/export-utils";

export async function GET() {
  const context = await requireOwnerForExport("all_calls");
  if (!context) {
    return Response.json({ error: "forbidden" }, { status: 403 });
  }

  const { current, supabase } = context;
  const { data } = await supabase
    .from("intake_calls")
    .select("*")
    .eq("tenant_id", current.profile.tenant_id)
    .order("created_at", { ascending: false });

  return csvResponse(
    toCsv((data ?? []).map((call) => flatten("call", call))),
    "all-calls.csv"
  );
}
