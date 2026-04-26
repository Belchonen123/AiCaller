import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import { dispatchCampaignCalls } from "@/lib/retell/dispatcher";
import { supabaseAdmin } from "@/lib/supabase/admin";

export const runtime = "nodejs";

const paramsSchema = z.object({
  id: z.string().uuid(),
});

const dispatchNowBodySchema = z.object({
  limit: z.number().int().positive().max(100).optional(),
});

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

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

export async function POST(request: Request, context: RouteContext) {
  const current = await getCurrentUser().catch(() => null);

  if (!current) {
    return new Response(null, {
      status: 401,
    });
  }

  if (!["owner", "admin"].includes(current.profile.role)) {
    return new Response(null, {
      status: 403,
    });
  }

  const parsedParams = paramsSchema.safeParse(await context.params);

  if (!parsedParams.success) {
    return Response.json(
      {
        error: "invalid",
      },
      {
        status: 400,
      }
    );
  }

  const parsedBody = dispatchNowBodySchema.safeParse(await request.json().catch(() => ({})));

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

  const { data: campaign, error } = await supabaseAdmin
    .from("campaigns")
    .select("id, status")
    .eq("id", parsedParams.data.id)
    .eq("tenant_id", current.profile.tenant_id)
    .single<{ id: string; status: string }>();

  if (error || !campaign) {
    return new Response(null, {
      status: 404,
    });
  }

  if (campaign.status !== "running") {
    return Response.json(
      {
        error: "Campaign must be running before dispatching calls.",
      },
      {
        status: 409,
      }
    );
  }

  const result = await dispatchCampaignCalls(
    current.profile.tenant_id,
    campaign.id,
    parsedBody.data.limit ?? 5
  );

  return Response.json(result);
}
