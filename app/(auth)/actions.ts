"use server";

import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

export type AuthActionState = {
  status: "idle" | "success" | "error";
  message: string;
};

const loginSchema = z.object({
  email: z.email("Enter a valid email address."),
  password: z.string().min(1, "Password is required."),
});

const signupSchema = z.object({
  email: z.email("Enter a valid email address."),
  password: z.string().min(8, "Password must be at least 8 characters."),
  fullName: z.string().trim().min(1, "Full name is required."),
  agencyName: z.string().trim().min(1, "Agency name is required."),
});

type SignupDetails = z.infer<typeof signupSchema>;
type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;

async function finishAgencySetup(
  supabase: SupabaseServerClient,
  details: SignupDetails,
  successMessage = "Agency account created — your workspace is ready."
): Promise<AuthActionState> {
  const { error: accountError } = await supabase.rpc("create_owner_account", {
    p_agency_name: details.agencyName,
    p_full_name: details.fullName,
    p_email: details.email,
  });

  if (accountError) {
    await supabase.auth.signOut();

    if (accountError.message.toLowerCase().includes("profile already exists")) {
      return {
        status: "error",
        message: "An account with this email already exists. Sign in with that email or use a different address.",
      };
    }

    console.error("auth_signup_setup_failed", {
      code: accountError.code,
    });

    return {
      status: "error",
      message: "We created your login but could not finish agency setup. Contact support with code AUTH-SETUP.",
    };
  }

  return {
    status: "success",
    message: successMessage,
  };
}

export async function loginAction(
  _previousState: AuthActionState,
  formData: FormData
): Promise<AuthActionState> {
  const parsed = loginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });

  if (!parsed.success) {
    return {
      status: "error",
      message: parsed.error.issues[0]?.message ?? "Check your email and password, then try again.",
    };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);

  if (error) {
    return {
      status: "error",
      message: "Invalid email or password. Check your credentials or reset your password.",
    };
  }

  return {
    status: "success",
    message: "Signed in — opening your agency dashboard.",
  };
}

export async function signupAction(
  _previousState: AuthActionState,
  formData: FormData
): Promise<AuthActionState> {
  const parsed = signupSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
    fullName: formData.get("fullName"),
    agencyName: formData.get("agencyName"),
  });

  if (!parsed.success) {
    return {
      status: "error",
      message: parsed.error.issues[0]?.message ?? "Check the highlighted signup fields, then try again.",
    };
  }

  const supabase = await createClient();
  const { data, error: signupError } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
  });

  if (signupError) {
    if (signupError.code === "user_already_exists") {
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: parsed.data.email,
        password: parsed.data.password,
      });

      if (!signInError) {
        return finishAgencySetup(
          supabase,
          parsed.data,
          "Agency account created — your workspace is ready."
        );
      }

      return {
        status: "error",
        message: "An account with this email already exists. Sign in with that email or use a different address.",
      };
    }

    console.error("auth_signup_failed", {
      code: signupError.code,
      status: signupError.status,
    });

    return {
      status: "error",
      message: "We could not create the account. Check your details or contact support with code AUTH-SIGNUP.",
    };
  }

  if (!data.user) {
    return {
      status: "error",
      message: "We could not create the account. Try again or contact support with code AUTH-NOUSER.",
    };
  }

  if (!data.session) {
    return {
      status: "error",
      message: "Confirm your email, then return here to complete agency setup.",
    };
  }

  return finishAgencySetup(supabase, parsed.data);
}
