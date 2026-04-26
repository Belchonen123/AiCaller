import { z } from "zod";
import {
  caregiverApplicantSchema,
  type CaregiverApplicant,
  type CaregiverFilters,
} from "@/app/dashboard/caregivers/types";
import { createClient } from "@/lib/supabase/server";

function splitParam(value: string | string[] | undefined) {
  const raw = Array.isArray(value) ? value.join(",") : value ?? "";
  return raw
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

export function parseCaregiverFilters(
  params: Record<string, string | string[] | undefined>
): CaregiverFilters {
  const get = (key: string, fallback: string) =>
    Array.isArray(params[key]) ? params[key][0] ?? fallback : params[key] ?? fallback;

  return {
    status: get("status", "all"),
    certifications: splitParam(params.cert),
    city: get("city", ""),
    experience: get("experience", "all"),
    language: get("language", "all"),
    transportation: get("transportation", "all"),
    champsReady: get("champs", "") === "1",
  };
}

function matchesExperience(years: number | null, range: string) {
  if (range === "all") return true;
  const value = years ?? 0;
  if (range === "0-1") return value <= 1;
  if (range === "1-3") return value >= 1 && value <= 3;
  if (range === "3-5") return value >= 3 && value <= 5;
  return value >= 5;
}

function applyFilters(items: CaregiverApplicant[], filters: CaregiverFilters) {
  return items.filter((item) => {
    if (filters.status !== "all" && item.status !== filters.status) {
      return false;
    }

    if (
      filters.certifications.some(
        (cert) => item[cert as keyof CaregiverApplicant] !== true
      )
    ) {
      return false;
    }

    if (
      filters.city &&
      !item.address_city?.toLowerCase().includes(filters.city.toLowerCase())
    ) {
      return false;
    }

    if (!matchesExperience(item.years_experience, filters.experience)) {
      return false;
    }

    if (
      filters.language !== "all" &&
      !item.languages_spoken?.some((language) =>
        language.toLowerCase().includes(filters.language.toLowerCase())
      )
    ) {
      return false;
    }

    if (filters.transportation !== "all") {
      const hasTransportation =
        item.has_reliable_transportation === true ||
        item.reliable_transportation === true ||
        item.has_transportation === true;
      if (filters.transportation === "yes" && !hasTransportation) return false;
      if (filters.transportation === "no" && hasTransportation) return false;
    }

    if (
      filters.champsReady &&
      !item.has_been_in_champs &&
      !item.willing_to_enroll_in_champs
    ) {
      return false;
    }

    return true;
  });
}

export async function loadCaregiverApplicants(params: {
  tenantId: string;
  filters: CaregiverFilters;
}) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("caregiver_applicants")
    .select("*, leads!caregiver_applicants_lead_tenant_fk(id, lead_type, lead_status, first_contact_at, assigned_to, profiles!leads_assigned_to_tenant_fk(full_name, email))")
    .eq("tenant_id", params.tenantId)
    .order("created_at", { ascending: false })
    .limit(200);

  if (error) {
    throw new Error(`Unable to load caregiver applicants: ${error.message}`);
  }

  const applicants = z.array(caregiverApplicantSchema).parse(data ?? []);

  return applyFilters(applicants, params.filters);
}
