import { timingSafeEqual } from "node:crypto";
import { z } from "zod";
import { dispatchCampaignCalls } from "@/lib/retell/dispatcher";
import { supabaseAdmin } from "@/lib/supabase/admin";

export const runtime = "nodejs";

const dispatchRequestSchema = z.object({
  campaign_id: z.string().uuid().optional(),
  tenant_id: z.string().uuid().optional(),
  limit: z.number().int().positive().max(100).optional(),
});

type CampaignRow = {
  id: string;
  tenant_id: string;
};

function methodNotAllowed() {
  return new Response(null, {
    status: 405,
    headers: {
      Allow: "GET, POST",
    },
  });
}

export const PUT = methodNotAllowed;
export const PATCH = methodNotAllowed;
export const DELETE = methodNotAllowed;
export const OPTIONS = methodNotAllowed;

function timingSafeEqualString(candidate: string, expected: string) {
  const candidateBuffer = Buffer.from(candidate);
  const expectedBuffer = Buffer.from(expected);

  if (candidateBuffer.length !== expectedBuffer.length) {
    return false;
  }

  return timingSafeEqual(candidateBuffer, expectedBuffer);
}

function isAuthorized(request: Request) {
  const internalSecret = process.env.INTERNAL_API_SECRET;
  const cronSecret = process.env.CRON_SECRET ?? internalSecret;
  const internalHeader = request.headers.get("x-internal-secret");
  const authorization = request.headers.get("authorization");
  const bearerToken = authorization?.match(/^Bearer\s+(.+)$/i)?.[1];

  return Boolean(
    (internalSecret && internalHeader && timingSafeEqualString(internalHeader, internalSecret)) ||
      (cronSecret && bearerToken && timingSafeEqualString(bearerToken, cronSecret))
  );
}

async function loadCampaigns(input: z.infer<typeof dispatchRequestSchema>) {
  let query = supabaseAdmin
    .from("campaigns")
    .select("id, tenant_id")
    .eq("status", "running");

  if (input.campaign_id) {
    query = query.eq("id", input.campaign_id);
  }

  if (input.tenant_id) {
    query = query.eq("tenant_id", input.tenant_id);
  }

  const { data, error } = await query.returns<CampaignRow[]>();

  if (error) {
    throw new Error("Unable to load running campaigns");
  }

  return data ?? [];
}

async function handleDispatch(request: Request, input: unknown) {
  if (!isAuthorized(request)) {
    return new Response(null, {
      status: 401,
    });
  }

  const parsedBody = dispatchRequestSchema.safeParse(input);

  if (!parsedBody.success) {
    return Response.json(
      {
        error: "invalid",
      },
      {
        status: 400,
      }
    );
  }

  const limit = parsedBody.data.limit ?? 5;
  const campaigns = await loadCampaigns(parsedBody.data);
  let totalLaunched = 0;
  let totalFailed = 0;

  for (const campaign of campaigns) {
    const result = await dispatchCampaignCalls(campaign.tenant_id, campaign.id, limit);
    totalLaunched += result.launched;
    totalFailed += result.failed;
  }

  return Response.json({
    campaigns_processed: campaigns.length,
    total_launched: totalLaunched,
    total_failed: totalFailed,
  });
}

export async function GET(request: Request) {
  return handleDispatch(request, {});
}

export async function POST(request: Request) {
  return handleDispatch(request, await request.json().catch(() => ({})));
}
