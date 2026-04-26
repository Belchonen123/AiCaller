import type { User } from "@supabase/supabase-js";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

const profileSchema = z.object({
  id: z.uuid(),
  tenant_id: z.uuid(),
  full_name: z.string().nullable(),
  email: z.email(),
  role: z.enum(["owner", "admin", "intake", "scheduler", "hr", "staff"]),
  created_at: z.string().nullable(),
});

const tenantSchema = z.object({
  id: z.uuid(),
  name: z.string(),
  agency_phone: z.string().nullable(),
  agency_address: z.string().nullable(),
  created_at: z.string().nullable(),
});

export type Profile = z.infer<typeof profileSchema>;
export type Tenant = z.infer<typeof tenantSchema>;

export type CurrentUser = {
  user: User;
  profile: Profile;
  tenant: Tenant;
};

export async function getOptionalUser(): Promise<CurrentUser | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return null;
  }

  const { data: profileData, error: profileError } = await supabase
    .from("profiles")
    .select("id, tenant_id, full_name, email, role, created_at")
    .eq("id", user.id)
    .single();

  if (profileError || !profileData) {
    throw new Error("Unable to load profile");
  }

  const profile = profileSchema.parse(profileData);

  const { data: tenantData, error: tenantError } = await supabase
    .from("tenants")
    .select("id, name, agency_phone, agency_address, created_at")
    .eq("id", profile.tenant_id)
    .single();

  if (tenantError || !tenantData) {
    throw new Error("Unable to load tenant");
  }

  return {
    user,
    profile,
    tenant: tenantSchema.parse(tenantData),
  };
}

export async function getCurrentUser(): Promise<CurrentUser> {
  const currentUser = await getOptionalUser();

  if (!currentUser) {
    throw new Error("Unauthenticated");
  }

  return currentUser;
}
