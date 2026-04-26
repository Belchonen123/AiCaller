"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useActionState, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  BotIcon,
  CheckCircle2Icon,
  PhoneCallIcon,
  Settings2Icon,
  SparklesIcon,
} from "lucide-react";
import { signupAction, type AuthActionState } from "@/app/(auth)/actions";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

const initialState: AuthActionState = {
  status: "idle",
  message: "",
};

export function SignupForm() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [onboardingOpen, setOnboardingOpen] = useState(false);
  const [step, setStep] = useState(0);
  const [state, formAction, pending] = useActionState(
    signupAction,
    initialState
  );
  const strength = useMemo(() => passwordStrength(password), [password]);

  useEffect(() => {
    if (state.status === "success") {
      toast.success(state.message);
      setOnboardingOpen(true);
    }

    if (state.status === "error") {
      toast.error(state.message);
    }
  }, [router, state]);

  return (
    <>
      <Card className="w-full max-w-md" padding="comfortable" elevation="raised">
        <div>
          <h1 className="font-heading text-xl font-semibold tracking-snug">
            Start your free trial
          </h1>
          <p className="mt-1 text-sm text-fg-secondary">
            Create your agency owner account. No credit card required.
          </p>
        </div>
        <form action={formAction} className="grid gap-4">
          <Input id="fullName" name="fullName" label="Full name" autoComplete="name" required />
          <Input id="email" name="email" type="email" label="Email" autoComplete="email" required />
          <div className="grid gap-2">
            <Input
              id="password"
              name="password"
              type="password"
              label="Password"
              autoComplete="new-password"
              minLength={8}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
            />
            <div className="grid gap-1">
              <div className="flex gap-1">
                {Array.from({ length: 4 }).map((_, index) => (
                  <span
                    key={index}
                    className={cn(
                      "h-1.5 flex-1 rounded-full bg-bg-muted",
                      index < strength.score && strength.color
                    )}
                  />
                ))}
              </div>
              <p className="text-xs text-fg-tertiary">{strength.label}</p>
            </div>
          </div>
          <Input id="agencyName" name="agencyName" label="Agency name" required />
          <Button type="submit" className="w-full" disabled={pending}>
            {pending ? "Creating agency account..." : "Create my agency account"}
          </Button>
        </form>
        <p className="text-center text-sm text-fg-secondary">
          Already have an account?{" "}
          <Link href="/login" className="font-medium text-fg-link underline">
            Sign in
          </Link>
        </p>
      </Card>
      <OnboardingDialog
        open={onboardingOpen}
        step={step}
        onStepChange={setStep}
        onSkip={() => {
          setOnboardingOpen(false);
          router.replace("/dashboard/leads");
          router.refresh();
        }}
      />
    </>
  );
}

function passwordStrength(value: string) {
  let score = 0;
  if (value.length >= 8) score += 1;
  if (/[A-Z]/.test(value) && /[a-z]/.test(value)) score += 1;
  if (/\d/.test(value)) score += 1;
  if (/[^A-Za-z0-9]/.test(value)) score += 1;
  const labels = ["Enter a password", "Weak", "Fair", "Strong", "Excellent"];
  const colors = ["", "bg-danger-fg", "bg-warning-fg", "bg-info-fg", "bg-success-fg"];
  return { score, label: labels[score], color: colors[score] };
}

const onboardingSteps = [
  {
    title: "Welcome — let's set up your AI agent",
    icon: SparklesIcon,
    body: "Use the guided setup or skip straight to your dashboard. You can return anytime.",
  },
  {
    title: "Pick a template",
    icon: BotIcon,
    body: "Choose from Intake Receptionist, After-hours Triage, Caregiver Recruiting, Authorization Follow-up, or Client Reactivation.",
  },
  {
    title: "Customize",
    icon: Settings2Icon,
    body: "Add agency name, service area, payer preferences, and handoff rules.",
  },
  {
    title: "Test it",
    icon: PhoneCallIcon,
    body: "Place a controlled test call and review the extracted intake fields.",
  },
  {
    title: "You're live",
    icon: CheckCircle2Icon,
    body: "Connect your Retell number, invite your team, and start capturing calls.",
  },
];

function OnboardingDialog({
  open,
  step,
  onStepChange,
  onSkip,
}: {
  open: boolean;
  step: number;
  onStepChange: (step: number) => void;
  onSkip: () => void;
}) {
  const current = onboardingSteps[step];
  const Icon = current.icon;

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => !nextOpen && onSkip()}>
      <DialogContent size="lg">
        <DialogHeader>
          <DialogTitle>{current.title}</DialogTitle>
        </DialogHeader>
        <div className="grid gap-5">
          <div className="grid place-items-center rounded-2xl bg-bg-emphasis p-8 text-center">
            <Icon className="mb-4 size-10 text-accent-primary" />
            <p className="max-w-md text-sm text-fg-secondary">{current.body}</p>
          </div>
          {step === 1 ? (
            <div className="grid gap-3 sm:grid-cols-2">
              {[
                "Intake Receptionist",
                "After-hours Triage",
                "Caregiver Recruiting",
                "Authorization Follow-up",
                "Client Reactivation",
              ].map((item) => (
                <button
                  key={item}
                  className="rounded-xl border border-border-default bg-bg-surface p-3 text-left text-sm font-medium hover:bg-bg-muted"
                  type="button"
                >
                  {item}
                </button>
              ))}
            </div>
          ) : null}
          <div className="flex items-center justify-between">
            <Button variant="link" onClick={onSkip}>
              Skip to dashboard
            </Button>
            <div className="flex gap-2">
              <Button
                variant="secondary"
                disabled={step === 0}
                onClick={() => onStepChange(Math.max(0, step - 1))}
              >
                Back
              </Button>
              <Button
                onClick={() => {
                  if (step >= onboardingSteps.length - 1) onSkip();
                  else onStepChange(step + 1);
                }}
              >
                {step >= onboardingSteps.length - 1 ? "Go to dashboard" : "Continue"}
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
