import { supabaseAdmin } from "@/lib/supabase/admin";

export const runtime = "nodejs";

async function checkDb() {
  const { error } = await supabaseAdmin.from("tenants").select("id").limit(1);
  return !error;
}

async function checkRetell() {
  const agentId = process.env.RETELL_AGENT_ID;
  const apiKey = process.env.RETELL_API_KEY;

  if (!agentId || !apiKey) {
    return false;
  }

  try {
    const response = await fetch(`https://api.retellai.com/get-agent/${agentId}`, {
      headers: { Authorization: `Bearer ${apiKey}` },
      cache: "no-store",
    });
    return response.ok;
  } catch {
    return false;
  }
}

export async function GET() {
  const [db, retellAgent] = await Promise.all([checkDb(), checkRetell()]);

  return Response.json({
    ok: db,
    db,
    retell_agent: retellAgent,
  });
}
