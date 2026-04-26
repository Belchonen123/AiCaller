import Link from "next/link";
import {
  BotIcon,
  CheckCircle2Icon,
  ChevronDownIcon,
  ClipboardListIcon,
  HeadphonesIcon,
  PhoneIncomingIcon,
  ShieldCheckIcon,
} from "lucide-react";
import { DemoVideoButton } from "@/app/(marketing)/demo-modal";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

const payers = [
  "Meridian",
  "Molina",
  "HAP",
  "Aetna Better Health",
  "Priority Health",
  "Blue Cross Complete",
  "MDHHS",
];

const pricing = [
  {
    name: "Starter",
    price: "$299",
    subtitle: "Up to 20 caregivers",
    features: ["AI receptionist", "Lead pipeline", "CSV exports", "Email support"],
  },
  {
    name: "Growth",
    price: "$599",
    subtitle: "Up to 75 caregivers",
    features: ["Everything in Starter", "Custom templates", "Team roles", "Priority support"],
  },
  {
    name: "Scale",
    price: "$1,199",
    subtitle: "Multi-location",
    features: ["Everything in Growth", "Multi-tenant controls", "Advanced reporting", "Implementation support"],
  },
];

const faqs = [
  "Is a BAA included?",
  "How does Actualizer support HIPAA workflows?",
  "Is this specific to Michigan Medicaid Home Help?",
  "Can it integrate with our phone system?",
  "Can we export our data?",
  "Does it support caregiver recruiting calls?",
  "How does pricing work?",
  "How is data secured?",
];

export default function MarketingHomePage() {
  return (
    <main>
      <section className="mx-auto grid max-w-7xl gap-10 px-4 py-16 sm:px-6 lg:grid-cols-[1fr_0.9fr] lg:px-8 lg:py-24">
        <div className="flex flex-col justify-center">
          <Badge variant="accent" className="mb-5 w-fit">
            AI-Powered Intake for Michigan Homecare
          </Badge>
          <h1 className="font-heading text-3xl font-bold tracking-tight text-fg-primary sm:text-5xl">
            Every call captured. Every lead organized. Every intake handed off — automatically.
          </h1>
          <p className="mt-5 max-w-2xl text-lg leading-normal text-fg-secondary">
            Built specifically for Michigan Medicaid Home Help agencies. From the first ring to the intake packet, your AI receptionist works around the clock.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Button render={<Link href="/signup" />} variant="accent" size="lg">
              Start free trial
            </Button>
            <DemoVideoButton />
          </div>
          <p className="mt-4 text-sm text-fg-tertiary">
            No credit card · BAA included · Cancel anytime
          </p>
        </div>
        <DashboardMockup />
      </section>

      <section className="border-y border-border-subtle bg-bg-surface py-8">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <p className="mb-5 text-sm font-medium text-fg-tertiary">
            Built for the agencies that handle...
          </p>
          <div className="grid gap-3 sm:grid-cols-4 lg:grid-cols-7">
            {payers.map((payer) => (
              <div key={payer} className="rounded-lg border border-border-subtle px-3 py-2 text-center text-xs font-semibold text-fg-tertiary grayscale">
                {payer}
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="features" className="mx-auto grid max-w-7xl gap-12 px-4 py-16 sm:px-6 lg:px-8">
        <Feature
          icon={PhoneIncomingIcon}
          title="Never miss a referral again"
          copy="Your AI receptionist answers 24/7, captures caller intent, and routes every referral into a structured lead queue."
        />
        <Feature
          icon={ClipboardListIcon}
          title="Intake forms that fill themselves"
          copy="Calls are extracted into Michigan Home Help fields, including ADLs, IADLs, coverage, contacts, and follow-up needs."
          flip
        />
        <Feature
          icon={HeadphonesIcon}
          title="Your team focuses on care, not data entry"
          copy="Dense dashboards, chart-style lead records, and handoff packets keep coordinators moving without losing context."
        />
      </section>

      <section className="bg-bg-emphasis py-16">
        <div className="mx-auto max-w-7xl px-4 text-center sm:px-6 lg:px-8">
          <h2 className="font-heading text-3xl font-semibold">Built on infrastructure healthcare buyers trust</h2>
          <div className="mt-8 grid gap-4 md:grid-cols-4">
            {[
              ["Anthropic Claude", "Clinical-grade language reasoning"],
              ["Retell AI", "Reliable voice automation"],
              ["Supabase", "Encrypted Postgres platform"],
              ["Vercel", "Secure global deployment"],
            ].map(([name, descriptor]) => (
              <Card key={name} padding="compact" className="items-center text-center">
                <ShieldCheckIcon className="size-6 text-accent-primary" />
                <h3 className="font-semibold">{name}</h3>
                <p className="text-sm text-fg-secondary">{descriptor}</p>
              </Card>
            ))}
          </div>
          <p className="mt-6 text-sm text-fg-secondary">
            All vendors covered by signed BAAs. Your data is encrypted in transit and at rest.
          </p>
        </div>
      </section>

      <section id="pricing" className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
        <div className="mb-8 rounded-xl bg-accent-secondary px-4 py-3 text-center text-sm font-semibold text-fg-on-brand">
          Save 20% with annual billing
        </div>
        <div className="grid gap-5 lg:grid-cols-3">
          {pricing.map((tier) => (
            <Card key={tier.name} elevation="raised">
              <div>
                <h3 className="font-heading text-xl font-semibold">{tier.name}</h3>
                <p className="text-sm text-fg-secondary">{tier.subtitle}</p>
              </div>
              <p className="text-4xl font-bold tabular-nums">{tier.price}<span className="text-sm font-medium text-fg-tertiary">/mo</span></p>
              <ul className="grid gap-2">
                {tier.features.map((feature) => (
                  <li key={feature} className="flex gap-2 text-sm">
                    <CheckCircle2Icon className="size-4 text-success-fg" />
                    {feature}
                  </li>
                ))}
              </ul>
              <Button render={<Link href="/signup" />} className="w-full">
                Start trial
              </Button>
            </Card>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-4xl px-4 py-16 sm:px-6 lg:px-8">
        <h2 className="mb-6 text-center font-heading text-3xl font-semibold">FAQ</h2>
        <div className="grid gap-3">
          {faqs.map((faq) => (
            <details key={faq} className="rounded-xl border border-border-default bg-bg-surface p-4">
              <summary className="flex cursor-pointer items-center justify-between font-medium">
                {faq}
                <ChevronDownIcon className="size-4" />
              </summary>
              <p className="mt-3 text-sm text-fg-secondary">
                Yes. Actualizer is designed for regulated homecare operations with exportable records, role-aware workflows, and healthcare-ready infrastructure.
              </p>
            </details>
          ))}
        </div>
      </section>

      <section className="bg-bg-emphasis px-4 py-16 text-center">
        <h2 className="font-heading text-3xl font-semibold">Ready to see your phones answered?</h2>
        <form className="mx-auto mt-6 flex max-w-md gap-2">
          <input className="h-10 flex-1 rounded-md border border-border-default bg-bg-surface px-3 text-sm" placeholder="work@email.com" type="email" />
          <Button render={<Link href="/signup" />}>Get started</Button>
        </form>
      </section>
    </main>
  );
}

function DashboardMockup() {
  return (
    <div className="relative rounded-2xl border border-border-default bg-bg-surface p-4 shadow-2xl">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <p className="text-xs font-medium text-fg-tertiary uppercase">Lead pipeline</p>
          <h3 className="font-semibold">Today’s intake queue</h3>
        </div>
        <Badge variant="success">Live</Badge>
      </div>
      <div className="grid gap-2">
        {["Mary Johnson", "Robert Ellis", "Angela Price"].map((name, index) => (
          <div key={name} className="grid grid-cols-[1fr_auto] rounded-lg border border-border-subtle p-3">
            <div>
              <p className="font-medium">{name}</p>
              <p className="text-xs text-fg-tertiary">Medicaid Home Help · {index + 2} ADLs</p>
            </div>
            <Badge variant={index === 0 ? "danger" : "routine"} tone={index === 0 ? "solid" : "subtle"}>
              {index === 0 ? "urgent" : "routine"}
            </Badge>
          </div>
        ))}
      </div>
      <div className="absolute -right-3 top-8 animate-pulse rounded-xl border border-border-default bg-bg-surface-raised p-3 shadow-lg">
        <p className="text-xs font-semibold">Live call incoming</p>
        <p className="text-xs text-fg-primary">(734) 555-0182</p>
      </div>
    </div>
  );
}

function Feature({
  icon: Icon,
  title,
  copy,
  flip = false,
}: {
  icon: typeof BotIcon;
  title: string;
  copy: string;
  flip?: boolean;
}) {
  return (
    <div className={`grid items-center gap-8 lg:grid-cols-2 ${flip ? "lg:[&>*:first-child]:order-2" : ""}`}>
      <div className="rounded-2xl border border-border-default bg-bg-surface p-6 shadow-lg">
        <Icon className="mb-4 size-8 text-accent-primary" />
        <div className="grid gap-3 rounded-xl bg-bg-surface-sunken p-4">
          <div className="h-3 w-3/4 rounded-full bg-bg-muted" />
          <div className="h-3 w-full rounded-full bg-bg-muted" />
          <div className="h-3 w-2/3 rounded-full bg-bg-muted" />
        </div>
      </div>
      <div>
        <h2 className="font-heading text-3xl font-semibold">{title}</h2>
        <p className="mt-4 text-lg text-fg-secondary">{copy}</p>
      </div>
    </div>
  );
}
