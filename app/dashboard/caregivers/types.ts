import { z } from "zod";

export const caregiverApplicantSchema = z.record(z.string(), z.unknown()).and(
  z.object({
    id: z.uuid(),
    tenant_id: z.uuid(),
    lead_id: z.uuid(),
    first_name: z.string().nullable(),
    last_name: z.string().nullable(),
    address_city: z.string().nullable(),
    status: z.string().nullable(),
    years_experience: z.number().nullable(),
    cna_certified: z.boolean().nullable(),
    hha_certified: z.boolean().nullable(),
    cpr_certified: z.boolean().nullable(),
    first_aid_certified: z.boolean().nullable(),
    languages_spoken: z.array(z.string()).nullable(),
    has_been_in_champs: z.boolean().nullable(),
    willing_to_enroll_in_champs: z.boolean().nullable(),
    referred_by: z.string().nullable(),
    created_at: z.string().nullable(),
    leads: z
      .object({
        id: z.uuid(),
        lead_type: z.string(),
        lead_status: z.string(),
        first_contact_at: z.string().nullable(),
        assigned_to: z.uuid().nullable(),
        profiles: z
          .object({
            full_name: z.string().nullable(),
            email: z.string().nullable(),
          })
          .nullable()
          .optional(),
      })
      .nullable()
      .optional(),
  })
);

export type CaregiverApplicant = z.infer<typeof caregiverApplicantSchema>;

export type CaregiverFilters = {
  status: string;
  certifications: string[];
  city: string;
  experience: string;
  language: string;
  transportation: string;
  champsReady: boolean;
};
