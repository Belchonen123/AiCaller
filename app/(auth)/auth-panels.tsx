"use client";

import { useEffect, useState } from "react";
import { CheckCircle2Icon, ClockIcon, FileCheckIcon, MapPinIcon, ShieldCheckIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const testimonials = [
  {
    quote:
      "Actualizer gives our intake team a clean queue every morning. After-hours calls no longer disappear into voicemail.",
    name: "Denise Carter",
    role: "Administrator",
    agency: "Great Lakes Home Support",
  },
  {
    quote:
      "The Michigan Home Help fields are already organized the way our coordinators think. It feels built for our workflow.",
    name: "Marcus Bell",
    role: "Intake Director",
    agency: "Lansing Care Partners",
  },
  {
    quote:
      "We care about speed, but we care more about trust. The audit trail and handoff packet changed the conversation.",
    name: "Priya Nair",
    role: "Owner",
    agency: "Oak County Homecare",
  },
];

const trustBadges = [
  { label: "HIPAA Compliant", icon: ShieldCheckIcon },
  { label: "BAA Signed", icon: FileCheckIcon },
  { label: "MDHHS-aware", icon: MapPinIcon },
  { label: "EVV-ready", icon: ClockIcon },
];

export function LoginTrustPanel({ mobile = false }: { mobile?: boolean }) {
  const [active, setActive] = useState(0);

  useEffect(() => {
    const interval = window.setInterval(
      () => setActive((current) => (current + 1) % testimonials.length),
      8000
    );
    return () => window.clearInterval(interval);
  }, []);

  return (
    <section
      className={cn(
        "relative overflow-hidden bg-bg-emphasis p-6 text-fg-primary",
        mobile
          ? "rounded-xl"
          : "flex min-h-svh flex-col justify-center rounded-l-[2rem] px-10"
      )}
    >
      <DottedGrid />
      <div className="relative z-10 grid gap-6">
        <p className="text-xs font-medium tracking-wide text-fg-tertiary uppercase">
          Trusted by Michigan Medicaid homecare agencies
        </p>
        <div className={cn("grid gap-4", mobile && "overflow-x-auto")}>
          <article className="rounded-2xl border border-border-default bg-bg-surface/85 p-5 shadow-md backdrop-blur">
            <p className="text-lg font-semibold leading-snug">
              “{testimonials[active].quote}”
            </p>
            <div className="mt-5">
              <p className="font-medium">{testimonials[active].name}</p>
              <p className="text-sm text-fg-secondary">
                {testimonials[active].role}, {testimonials[active].agency}
              </p>
            </div>
          </article>
        </div>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {trustBadges.map((badge) => {
            const Icon = badge.icon;
            return (
              <div
                key={badge.label}
                className="flex items-center gap-2 rounded-lg border border-border-default bg-bg-surface/80 px-3 py-2 text-xs font-medium"
              >
                <Icon className="size-4 text-accent-primary" />
                {badge.label}
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

export function SignupValuePanel() {
  const values = [
    "AI receptionist live in 10 minutes",
    "Captures every call, even after hours",
    "Automatic intake extraction (Michigan Home Help fields)",
    "Multi-tenant ready, HIPAA-compliant infrastructure",
    "CSV export, custom templates, full lead pipeline",
    "Cancel anytime, no setup fee",
  ];

  return (
    <section className="relative overflow-hidden rounded-l-[2rem] bg-bg-emphasis p-10">
      <DottedGrid />
      <div className="relative z-10 grid gap-6">
        <p className="text-xs font-medium tracking-wide text-fg-tertiary uppercase">
          What you get
        </p>
        <div className="grid gap-3">
          {values.map((value) => (
            <div key={value} className="flex items-start gap-3 rounded-xl bg-bg-surface/80 p-3">
              <CheckCircle2Icon className="mt-0.5 size-5 text-success-fg" />
              <span className="text-sm font-medium">{value}</span>
            </div>
          ))}
        </div>
        <p className="text-xs text-fg-tertiary">
          By signing up, you agree to our Terms and HIPAA BAA.
        </p>
        <Badge variant="success" className="w-fit">
          BAA included with every plan
        </Badge>
      </div>
    </section>
  );
}

function DottedGrid() {
  return (
    <div
      aria-hidden="true"
      className="absolute inset-0 opacity-[0.08]"
      style={{
        backgroundImage:
          "radial-gradient(circle at 1px 1px, var(--color-fg-primary) 1px, transparent 0)",
        backgroundSize: "18px 18px",
      }}
    />
  );
}
