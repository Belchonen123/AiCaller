import { checkRequiredEnv } from "@/lib/env-check";

export async function GET() {
  if (process.env.NODE_ENV === "production") {
    return Response.json({ error: "Not found" }, { status: 404 });
  }

  const { missing, misconfigured } = checkRequiredEnv();

  return Response.json({
    ok: missing.length === 0 && misconfigured.length === 0,
    missing,
    misconfigured,
  });
}
