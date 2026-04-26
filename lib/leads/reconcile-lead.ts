import { z } from "zod";
import { maskPhone, normalizePhone } from "@/lib/phone";
import { supabaseAdmin } from "@/lib/supabase/admin";

const intakeCallSchema = z.object({
  id: z.uuid(),
  tenant_id: z.uuid(),
  caller_phone: z.string().nullable(),
  caller_phone_normalized: z.string().nullable(),
  extraction: z.unknown().nullable(),
});

const reconciliationResultSchema = z.object({
  lead_id: z.uuid(),
  action: z.enum(["created", "merged"]),
});

export type ReconciliationResult = z.infer<typeof reconciliationResultSchema>;

function stringifyValue(value: unknown): string {
  if (value === null || value === undefined) {
    return "";
  }

  if (typeof value === "string") {
    return value;
  }

  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }

  if (Array.isArray(value)) {
    return value
      .filter((item): item is string | number | boolean =>
        ["string", "number", "boolean"].includes(typeof item)
      )
      .map(String)
      .join(", ");
  }

  return "[captured]";
}

export function maskValueIfPhi(fieldName: string, value: unknown): string {
  const normalizedFieldName = fieldName.toLowerCase();
  const text = stringifyValue(value);

  if (normalizedFieldName === "date_of_birth" || normalizedFieldName === "dob") {
    return "REDACTED";
  }

  if (
    normalizedFieldName === "medicaid_id" ||
    normalizedFieldName === "medicare_id"
  ) {
    return `XXXX${text.replace(/\D/g, "").slice(-4)}`;
  }

  if (
    normalizedFieldName.includes("phone") ||
    normalizedFieldName === "caller_phone"
  ) {
    return maskPhone(text);
  }

  if (
    normalizedFieldName.includes("address") ||
    normalizedFieldName === "home_address"
  ) {
    if (normalizedFieldName.includes("city")) {
      return text;
    }

    return "REDACTED";
  }

  return text;
}

function getNormalizedCallerPhone(call: z.infer<typeof intakeCallSchema>) {
  const alreadyNormalized = call.caller_phone_normalized
    ? normalizePhone(call.caller_phone_normalized)
    : null;

  if (alreadyNormalized) {
    return alreadyNormalized;
  }

  return call.caller_phone ? normalizePhone(call.caller_phone) : null;
}

export async function reconcileLead(
  callId: string,
  tenantId: string
): Promise<ReconciliationResult> {
  const ids = z
    .object({
      callId: z.uuid(),
      tenantId: z.uuid(),
    })
    .parse({ callId, tenantId });

  const { data: callData, error: callError } = await supabaseAdmin
    .from("intake_calls")
    .select("id, tenant_id, caller_phone, caller_phone_normalized, extraction")
    .eq("id", ids.callId)
    .eq("tenant_id", ids.tenantId)
    .single();

  if (callError || !callData) {
    throw new Error("Intake call not found");
  }

  const call = intakeCallSchema.parse(callData);

  if (!call.extraction) {
    const { error: rpcError } = await supabaseAdmin.rpc("reconcile_lead_from_call", {
      p_call_id: ids.callId,
      p_tenant_id: ids.tenantId,
      p_normalized_phone: getNormalizedCallerPhone(call),
    });

    if (rpcError) {
      throw new Error("Lead reconciliation failed");
    }

    throw new Error("Extraction required");
  }

  const { data, error } = await supabaseAdmin.rpc("reconcile_lead_from_call", {
    p_call_id: ids.callId,
    p_tenant_id: ids.tenantId,
    p_normalized_phone: getNormalizedCallerPhone(call),
  });

  if (error) {
    throw new Error("Lead reconciliation failed");
  }

  const parsed = z.array(reconciliationResultSchema).safeParse(data);

  if (!parsed.success || parsed.data.length === 0) {
    throw new Error("Lead reconciliation failed");
  }

  return parsed.data[0];
}
