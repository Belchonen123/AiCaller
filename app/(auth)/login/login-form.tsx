"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useActionState, useEffect } from "react";
import { toast } from "sonner";
import { loginAction, type AuthActionState } from "@/app/(auth)/actions";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";

const initialState: AuthActionState = {
  status: "idle",
  message: "",
};

export function LoginForm() {
  const router = useRouter();
  const [state, formAction, pending] = useActionState(loginAction, initialState);

  useEffect(() => {
    if (state.status === "success") {
      toast.success(state.message);
      router.replace("/dashboard/leads");
      router.refresh();
    }

    if (state.status === "error") {
      toast.error(state.message);
    }
  }, [router, state]);

  return (
    <Card className="w-full max-w-md" padding="comfortable" elevation="raised">
      <div>
        <h1 className="font-heading text-xl font-semibold tracking-snug">
          Sign in to your agency dashboard
        </h1>
        <p className="mt-1 text-sm text-fg-secondary">
          Access your AI intake system, leads, and team.
        </p>
      </div>
      <form action={formAction} className="grid gap-4">
        <Input
          id="email"
          name="email"
          type="email"
          label="Email"
          autoComplete="email"
          required
        />
        <Input
          id="password"
          name="password"
          type="password"
          label="Password"
          autoComplete="current-password"
          required
        />
        <Button type="submit" className="w-full" disabled={pending}>
          {pending ? "Signing in..." : "Sign in"}
        </Button>
      </form>
      <Link href="/forgot-password" className="text-center text-sm font-medium text-fg-link hover:underline">
        Forgot password?
      </Link>
      <Separator label="OR" />
      <Button variant="secondary" className="w-full" render={<Link href="/signup" />}>
        Sign up for a free trial
      </Button>
    </Card>
  );
}
