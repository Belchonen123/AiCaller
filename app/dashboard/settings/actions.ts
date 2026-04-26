"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export type SettingsActionResult = {
  ok: boolean;
  message: string;
};

const roleSchema = z.enum(["owner", "admin", "intake", "scheduler", "hr", "staff"]);

async function requireAdmin() {
  const current = await getCurrentUser();
  if (!["owner", "admin"].includes(current.profile.role)) {
    throw new Error("Forbidden");
  }
  return current;
}

async function requireOwner() {
  const current = await getCurrentUser();
  if (current.profile.role !== "owner") {
    throw new Error("Forbidden");
  }
  return current;
}

export async function updateAgencyInfo(input: unknown): Promise<SettingsActionResult> {
  const parsed = z
    .object({
      name: z.string().trim().min(1),
      agency_phone: z.string().trim().optional(),
      agency_address: z.string().trim().optional(),
    })
    .safeParse(input);

  if (!parsed.success) {
    return { ok: false, message: "Agency name is required." };
  }

  const current = await requireAdmin();
  const supabase = await createClient();
  const { error } = await supabase
    .from("tenants")
    .update({
      name: parsed.data.name,
      agency_phone: parsed.data.agency_phone || null,
      agency_address: parsed.data.agency_address || null,
    })
    .eq("id", current.profile.tenant_id);

  if (error) {
    return { ok: false, message: "Unable to update agency info." };
  }

  revalidatePath("/dashboard/settings");
  return { ok: true, message: "Agency info saved." };
}

export async function inviteStaff(input: unknown): Promise<SettingsActionResult> {
  const parsed = z
    .object({
      email: z.email(),
      role: roleSchema.exclude(["owner"]),
    })
    .safeParse(input);

  if (!parsed.success) {
    return { ok: false, message: "Enter a valid email and role." };
  }

  const current = await requireAdmin();
  const { data, error } = await supabaseAdmin.auth.admin.inviteUserByEmail(
    parsed.data.email
  );

  if (error || !data.user) {
    return { ok: false, message: "Unable to send invite." };
  }

  await supabaseAdmin.from("profiles").upsert({
    id: data.user.id,
    tenant_id: current.profile.tenant_id,
    email: parsed.data.email,
    role: parsed.data.role,
  });

  revalidatePath("/dashboard/settings");
  return { ok: true, message: "Invite sent." };
}

export async function updateStaffRole(input: unknown): Promise<SettingsActionResult> {
  const parsed = z
    .object({
      id: z.uuid(),
      role: roleSchema,
    })
    .safeParse(input);

  if (!parsed.success) {
    return { ok: false, message: "Invalid role update." };
  }

  const current = await requireAdmin();
  if (parsed.data.role === "owner" && current.profile.role !== "owner") {
    return { ok: false, message: "Only owners can assign owner role." };
  }

  const { error } = await supabaseAdmin
    .from("profiles")
    .update({ role: parsed.data.role })
    .eq("id", parsed.data.id)
    .eq("tenant_id", current.profile.tenant_id);

  if (error) {
    return { ok: false, message: "Unable to update role." };
  }

  revalidatePath("/dashboard/settings");
  return { ok: true, message: "Role updated." };
}

export async function removeStaff(input: unknown): Promise<SettingsActionResult> {
  const parsed = z.object({ id: z.uuid() }).safeParse(input);

  if (!parsed.success) {
    return { ok: false, message: "Invalid staff member." };
  }

  const current = await requireOwner();
  if (parsed.data.id === current.profile.id) {
    return { ok: false, message: "Owners cannot remove themselves." };
  }

  const { error } = await supabaseAdmin
    .from("profiles")
    .delete()
    .eq("id", parsed.data.id)
    .eq("tenant_id", current.profile.tenant_id);

  if (error) {
    return { ok: false, message: "Unable to remove staff." };
  }

  await supabaseAdmin.auth.admin.deleteUser(parsed.data.id);
  revalidatePath("/dashboard/settings");
  return { ok: true, message: "Staff member removed." };
}

export async function cancelAllRunningCampaigns(): Promise<SettingsActionResult> {
  const current = await requireOwner();
  const now = new Date().toISOString();
  const { data: campaigns, error: campaignLoadError } = await supabaseAdmin
    .from("campaigns")
    .select("id")
    .eq("tenant_id", current.profile.tenant_id)
    .eq("status", "running")
    .returns<Array<{ id: string }>>();

  if (campaignLoadError) {
    return { ok: false, message: "Unable to load running campaigns." };
  }

  const campaignIds = (campaigns ?? []).map((campaign) => campaign.id);

  if (campaignIds.length === 0) {
    return { ok: true, message: "No running campaigns to cancel." };
  }

  const { error: campaignError } = await supabaseAdmin
    .from("campaigns")
    .update({ status: "cancelled", completed_at: now })
    .eq("tenant_id", current.profile.tenant_id)
    .in("id", campaignIds);

  if (campaignError) {
    return { ok: false, message: "Unable to cancel campaigns." };
  }

  const { error: taskError } = await supabaseAdmin
    .from("call_tasks")
    .update({ status: "cancelled", updated_at: now })
    .eq("tenant_id", current.profile.tenant_id)
    .in("campaign_id", campaignIds)
    .eq("status", "in_progress");

  if (taskError) {
    return { ok: false, message: "Campaigns cancelled, but some tasks could not be cancelled." };
  }

  revalidatePath("/dashboard/settings");
  revalidatePath("/dashboard/campaigns");
  return { ok: true, message: "All running campaigns were cancelled." };
}
