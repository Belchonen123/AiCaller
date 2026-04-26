import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { z } from "zod";
import { normalizePhone } from "@/lib/phone";
import { supabaseAdmin } from "@/lib/supabase/admin";

export const runtime = "nodejs";

const lookupCallerSchema = z.object({
  args: z.object({
    phone_number: z.string().min(1),
  }),
});

const lookupRowSchema = z.object({
  id: z.string(),
  created_at: z.string().nullable(),
  updated_at: z.string().nullable().optional(),
  relationship_to_client: z.string().nullable(),
  leads: z
    .object({
      id: z.string(),
      lead_type: z.string(),
      lead_status: z.string(),
      last_contact_at: z.string().nullable(),
      created_at: z.string().nullable(),
      profiles: z
        .object({
          full_name: z.string().nullable(),
        })
        .nullable()
        .optional(),
      prospective_clients: z
        .array(
          z.object({
            address_city: z.string().nullable(),
            county: z.string().nullable(),
          })
        )
        .nullable()
        .optional(),
    })
    .nullable(),
});

type LookupRow = z.infer<typeof lookupRowSchema>;

function methodNotAllowed() {
  return new Response(null, {
    status: 405,
    headers: {
      Allow: "POST",
    },
  });
}

export const GET = methodNotAllowed;
export const PUT = methodNotAllowed;
export const PATCH = methodNotAllowed;
export const DELETE = methodNotAllowed;
export const OPTIONS = methodNotAllowed;

function getRequiredEnv(name: string): string {
  const value = process.env[name];

  if (!value) {
    throw new Error(`${name} is required`);
  }

  return value;
}

function timingSafeCompare(candidate: string, expected: string): boolean {
  const candidateBuffer = Buffer.from(candidate);
  const expectedBuffer = Buffer.from(expected);

  if (candidateBuffer.length !== expectedBuffer.length) {
    return false;
  }

  return timingSafeEqual(candidateBuffer, expectedBuffer);
}

function verifySignature(rawBody: string, signature: string | null): boolean {
  if (!signature) {
    return false;
  }

  const secret = getRequiredEnv("RETELL_WEBHOOK_SECRET");
  const expectedHex = createHmac("sha256", secret).update(rawBody).digest("hex");
  const expectedBase64 = createHmac("sha256", secret)
    .update(rawBody)
    .digest("base64");
  const normalizedSignature = signature.trim().replace(/^sha256=/, "");

  return (
    timingSafeCompare(normalizedSignature, expectedHex) ||
    timingSafeCompare(normalizedSignature, expectedBase64)
  );
}

function hashPhone(normalizedPhone: string): string {
  return createHash("sha256").update(normalizedPhone).digest("hex");
}

function formatLeadType(leadType: string): string {
  if (leadType === "client_referral") {
    return "a new referral";
  }

  if (leadType === "existing_client") {
    return "an existing client";
  }

  if (leadType === "caregiver_applicant") {
    return "a caregiver applicant";
  }

  return "a lead";
}

function relativeDays(value: string | null | undefined): string {
  if (!value) {
    return "recently";
  }

  const diffMs = Date.now() - new Date(value).getTime();
  const days = Math.max(0, Math.round(diffMs / 86_400_000));

  if (days === 0) {
    return "today";
  }

  if (days === 1) {
    return "yesterday";
  }

  if (days < 7) {
    return `${days} days ago`;
  }

  const weeks = Math.round(days / 7);
  if (weeks === 1) {
    return "last week";
  }

  return `${weeks} weeks ago`;
}

function firstNameOnly(fullName: string | null | undefined): string | null {
  const firstName = fullName?.trim().split(/\s+/)[0];

  return firstName || null;
}

function getClientCity(row: LookupRow): string | null {
  const client = row.leads?.prospective_clients?.[0];

  return client?.address_city || null;
}

function buildSummary(rows: LookupRow[], matchCount: number): string {
  if (matchCount === 0 || rows.length === 0) {
    return "No previous calls from this number.";
  }

  const row = rows[0];
  const lead = row.leads;

  if (!lead) {
    return "No previous calls from this number.";
  }

  const when = relativeDays(lead.last_contact_at ?? row.updated_at ?? row.created_at);
  const leadType = formatLeadType(lead.lead_type);
  const city = getClientCity(row);
  const status = lead.lead_status.replaceAll("_", " ");
  const assignedName = firstNameOnly(lead.profiles?.full_name);

  if (matchCount > 1) {
    return `This number has called ${matchCount} times about ${leadType}. Most recent activity was ${when}. Status is '${status}'.`;
  }

  const location = city ? ` for a client in ${city}` : "";
  const assignment = assignedName
    ? ` A staff member named ${assignedName} is assigned.`
    : "";

  return `This number called ${when} about ${leadType}${location}. Status is '${status}'.${assignment}`;
}

async function insertLookupEvent(tenantId: string, normalizedPhone: string, matchCount: number) {
  await supabaseAdmin.from("call_events").insert({
    tenant_id: tenantId,
    event_type: "tool_lookup_caller",
    payload: {
      phone_hash: hashPhone(normalizedPhone),
      match_count: matchCount,
    },
  });
}

export async function POST(request: Request) {
  try {
    const rawBody = await request.text();

    if (!verifySignature(rawBody, request.headers.get("x-retell-signature"))) {
      return new Response(null, {
        status: 401,
      });
    }

    const parsed = lookupCallerSchema.safeParse(JSON.parse(rawBody));

    if (!parsed.success) {
      return Response.json(
        {
          result: "No previous calls from this number.",
        },
        {
          status: 200,
        }
      );
    }

    const normalizedPhone = normalizePhone(parsed.data.args.phone_number);

    if (!normalizedPhone) {
      return Response.json({
        result: "No previous calls from this number.",
      });
    }

    const tenantId = getRequiredEnv("DEMO_TENANT_ID");
    const { data, count, error } = await supabaseAdmin
      .from("contacts")
      .select(
        "id, created_at, updated_at, relationship_to_client, leads!inner(id, lead_type, lead_status, last_contact_at, created_at, profiles(full_name), prospective_clients(address_city, county))",
        {
          count: "exact",
        }
      )
      .eq("tenant_id", tenantId)
      .eq("phone", normalizedPhone)
      .order("created_at", { ascending: false })
      .limit(3);

    if (error) {
      return Response.json(
        {
          result: "No previous calls from this number.",
        },
        {
          status: 200,
        }
      );
    }

    const rows = z.array(lookupRowSchema).safeParse(data ?? []);
    const safeRows = rows.success ? rows.data : [];
    const matchCount = count ?? safeRows.length;

    await insertLookupEvent(tenantId, normalizedPhone, matchCount);

    return Response.json({
      result: buildSummary(safeRows, matchCount),
    });
  } catch {
    return Response.json(
      {
        result: "No previous calls from this number.",
      },
      {
        status: 200,
      }
    );
  }
}
