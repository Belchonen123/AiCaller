"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, useTransition } from "react";
import {
  BabyIcon,
  BriefcaseMedicalIcon,
  ChevronRightIcon,
  CircleHelpIcon,
  ClockIcon,
  FileTextIcon,
  HeartPulseIcon,
  MicIcon,
  PhoneCallIcon,
  PhoneIncomingIcon,
  PhoneOffIcon,
  PhoneIcon,
  ShieldAlertIcon,
  SparklesIcon,
  UserRoundIcon,
  Wand2Icon,
  XIcon,
} from "lucide-react";
import { toast } from "sonner";
import { RetellConnectionGuide } from "@/app/dashboard/retell-connection-guide";
import { cancelTestCall, placeCallNow } from "@/app/dashboard/test-call/actions";
import { Alert, AlertAction, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import type {
  TestCallScenarioId,
  testCallScenarios,
} from "@/lib/campaigns/test-scenarios";
import {
  getRetellPhoneNumberAgentIds,
  retellAgentName,
  type RetellConnectionAgent,
  type RetellConnectionPhoneNumber,
  type RetellConnectionState,
} from "@/lib/retell/connection-state";

type TestCallClientProps = {
  defaultPhone: string;
  scenarios: typeof testCallScenarios;
  agentId: string;
  fromPhone: string;
  connectionState: RetellConnectionState;
  issues: string[];
  agents: RetellConnectionAgent[];
  phoneNumbers: RetellConnectionPhoneNumber[];
  initialRecent: TestCallStatus["recent"];
};

type TestCallStatus = {
  task: TestTask | null;
  recent: TestTask[];
};

type TestTask = {
  id: string;
  status: string;
  disposition: string | null;
  scenario: string;
  call_href: string | null;
  lead_href?: string | null;
  call_id?: string | null;
  duration_seconds?: number | null;
  transcript?: string | null;
  extraction?: unknown | null;
  has_extraction: boolean;
  created_at: string | null;
};
type TestScenario = (typeof testCallScenarios)[number];

const activeStatuses = new Set(["queued", "scheduled", "in_progress"]);
const terminalStatuses = new Set(["completed", "failed", "cancelled", "voicemail", "no_answer", "busy"]);
const tips = [
  "Try saying 'I think my mom needs help' — see how the AI guides you",
  "Mention an MCO like Meridian — watch the payer auto-extract",
  "Pause for a long time — the AI handles silence well",
  "Say 'I'm having an emergency' — see emergency escalation",
  "Hang up mid-sentence — extraction still works",
];
const demoScenarioOrder: TestCallScenarioId[] = [
  "adult-child-mom",
  "mco-case-manager",
  "experienced-hha",
  "family-paid-caregiver",
  "existing-client-status",
  "fall-red-flag",
  "custom",
];
const testDynamicVariableFields = [
  {
    key: "recipient_first_name",
    label: "Recipient first name",
    defaultValue: "Test",
  },
  {
    key: "recipient_last_name",
    label: "Recipient last name",
    defaultValue: "Caller",
  },
  {
    key: "recipient_phone",
    label: "Recipient phone",
    defaultValue: "",
  },
] as const;

const scenarioMeta: Record<string, { icon: typeof PhoneIcon; title: string; description: string }> = {
  "adult-child-mom": {
    icon: HeartPulseIcon,
    title: "Adult child calling about mom",
    description: "A family referral with ADLs, meals, and safety needs.",
  },
  "mco-case-manager": {
    icon: BriefcaseMedicalIcon,
    title: "MCO case manager referral",
    description: "A payer-driven referral with plan context.",
  },
  "experienced-hha": {
    icon: UserRoundIcon,
    title: "Experienced HHA applicant",
    description: "A caregiver recruiting conversation.",
  },
  "family-paid-caregiver": {
    icon: BabyIcon,
    title: "Family caregiver wants pay",
    description: "A relative asks about paid Medicaid care.",
  },
  "existing-client-status": {
    icon: ClockIcon,
    title: "Existing client status update",
    description: "A current client asks for service status.",
  },
  "fall-red-flag": {
    icon: ShieldAlertIcon,
    title: "Emergency red-flag test",
    description: "A fall or safety issue triggers escalation.",
  },
  custom: {
    icon: Wand2Icon,
    title: "Custom scenario",
    description: "Write your own caller behavior and watch extraction.",
  },
};

async function fetchStatus(taskId: string | null) {
  const params = taskId ? `?task_id=${encodeURIComponent(taskId)}` : "";
  const response = await fetch(`/api/test-call/status${params}`, { cache: "no-store" });
  if (!response.ok) return null;
  return (await response.json()) as TestCallStatus;
}

function formatDate(value: string | null) {
  return value
    ? new Intl.DateTimeFormat("en-US", { dateStyle: "short", timeStyle: "short" }).format(
        new Date(value)
      )
    : "";
}

function formatDuration(seconds: number) {
  const minutes = Math.floor(seconds / 60);
  const remaining = seconds % 60;
  return `${minutes}:${String(remaining).padStart(2, "0")}`;
}

function extractionRecord(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function stringValue(value: unknown, fallback = "Pending") {
  return typeof value === "string" && value.trim() ? value : fallback;
}

function displayValue(value: unknown, fallback = "Pending") {
  if (Array.isArray(value)) {
    return value.length ? value.join(", ") : fallback;
  }

  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }

  return stringValue(value, fallback);
}

export function TestCallClient({
  defaultPhone,
  scenarios,
  agentId,
  fromPhone,
  connectionState,
  issues,
  agents,
  phoneNumbers,
  initialRecent,
}: TestCallClientProps) {
  const [pending, startTransition] = useTransition();
  const demoScenarios = useMemo(() => {
    const byId = new Map(scenarios.map((scenario) => [scenario.id, scenario]));
    return demoScenarioOrder.flatMap((id) => {
      const scenario = byId.get(id);
      return scenario ? [scenario] : [];
    });
  }, [scenarios]);
  const [selectedScenario, setSelectedScenario] = useState<TestCallScenarioId>(
    demoScenarios[0]?.id ?? "custom"
  );
  const [currentTaskId, setCurrentTaskId] = useState<string | null>(null);
  const [status, setStatus] = useState<TestCallStatus>({
    task: null,
    recent: initialRecent,
  });
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [now, setNow] = useState(Date.now());
  const [visibleWords, setVisibleWords] = useState(0);
  const [tipIndex, setTipIndex] = useState(0);
  const [selectedAgentId, setSelectedAgentId] = useState(agentId);
  const linkedPhoneNumbers = useMemo(
    () =>
      phoneNumbers.filter((phoneNumber) =>
        getRetellPhoneNumberAgentIds(phoneNumber).includes(selectedAgentId)
      ),
    [phoneNumbers, selectedAgentId]
  );
  const [selectedFromPhone, setSelectedFromPhone] = useState(fromPhone);
  const [dispatchError, setDispatchError] = useState<string | null>(null);
  const task = status.task;
  const isCustom = selectedScenario === "custom";
  const isWaitingForArtifacts =
    task?.status === "completed" && (!task.call_href || !task.transcript || !task.has_extraction);
  const isActive = currentTaskId
    ? task
      ? activeStatuses.has(task.status) ||
        isWaitingForArtifacts
      : true
    : false;
  const isComplete = Boolean(task && terminalStatuses.has(task.status) && !isWaitingForArtifacts);
  const elapsedSeconds = startedAt ? Math.max(0, Math.floor((now - startedAt) / 1000)) : 0;

  useEffect(() => {
    const interval = window.setInterval(() => setTipIndex((index) => (index + 1) % tips.length), 6000);
    return () => window.clearInterval(interval);
  }, []);

  useEffect(() => {
    const interval = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(interval);
  }, []);

  useEffect(() => {
    if (!currentTaskId || !isActive) return;
    const interval = setInterval(() => {
      void fetchStatus(currentTaskId).then((nextStatus) => {
        if (nextStatus) setStatus(nextStatus);
      });
    }, 2500);

    return () => clearInterval(interval);
  }, [currentTaskId, isActive]);

  const transcriptWords = useMemo(
    () =>
      (task?.transcript ||
        "The AI greets the caller, asks about care needs, confirms payer details, and summarizes the next step for intake.")
        .split(/\s+/)
        .filter(Boolean),
    [task?.transcript]
  );

  useEffect(() => {
    if (!isComplete) {
      setVisibleWords(0);
      return;
    }
    const interval = window.setInterval(() => {
      setVisibleWords((count) => Math.min(transcriptWords.length, count + 3));
    }, 140);
    return () => window.clearInterval(interval);
  }, [isComplete, transcriptWords.length]);

  function submit(formData: FormData) {
    startTransition(async () => {
      const testDynamicVariables = Object.fromEntries(
        testDynamicVariableFields.flatMap((field) => {
          const value = formData.get(`dynamic_variable__${field.key}`)?.toString().trim();
          return value ? [[field.key, value]] : [];
        })
      );
      setDispatchError(null);
      const result = await placeCallNow({
        phone: formData.get("phone"),
        scenario_id: selectedScenario,
        custom_script_variables:
          formData.get("custom_script_variables")?.toString() || undefined,
        test_dynamic_variables: testDynamicVariables,
        save_default_phone: formData.get("save_default_phone") === "on",
        agent_id: selectedAgentId,
        from_phone: selectedFromPhone,
      });

      if (!result.ok || !result.call_task_id) {
        setDispatchError(result.message);
        toast.error(result.message);
        return;
      }

      setDispatchError(null);
      toast.success("Call placed — you'll ring in ~5 seconds.");
      setCurrentTaskId(result.call_task_id);
      setStartedAt(Date.now());
      const nextStatus = await fetchStatus(result.call_task_id);
      if (nextStatus) setStatus(nextStatus);
    });
  }

  function cancelCurrentCall() {
    if (!currentTaskId) return;
    startTransition(async () => {
      const result = await cancelTestCall({ task_id: currentTaskId });
      if (result.ok) {
        toast.success(result.message);
        const nextStatus = await fetchStatus(currentTaskId);
        if (nextStatus) setStatus(nextStatus);
      } else {
        toast.error(result.message);
      }
    });
  }

  return (
    <div className="relative min-h-[calc(100svh-9rem)]">
      <TipsRail tip={tips[tipIndex]} />
      <main className="mx-auto grid max-w-2xl gap-8 py-4 xl:mr-[22rem] xl:max-w-2xl">
        <section className="text-center">
          <p className="text-xs font-medium tracking-wide text-fg-tertiary uppercase">Live test</p>
          <h1 className="mt-3 font-heading text-4xl font-semibold tracking-tight text-fg-primary">
            Place a call — hear it ring
          </h1>
          <p className="mx-auto mt-4 max-w-xl text-base leading-normal text-fg-secondary">
            Enter your phone number, pick a scenario, and your AI agent will call you within seconds.
            After the call, the transcript and structured extraction appear here.
          </p>
        </section>

        {!currentTaskId ? (
          connectionState === "ok" ? (
            <TestCallForm
              defaultPhone={defaultPhone}
              demoScenarios={demoScenarios}
              selectedScenario={selectedScenario}
              setSelectedScenario={setSelectedScenario}
              isCustom={isCustom}
              pending={pending}
              agents={agents}
              linkedPhoneNumbers={linkedPhoneNumbers}
              selectedAgentId={selectedAgentId}
              selectedFromPhone={selectedFromPhone}
              setSelectedAgentId={(nextAgentId) => {
                setSelectedAgentId(nextAgentId);
                const nextPhone = phoneNumbers.find((phoneNumber) =>
                  getRetellPhoneNumberAgentIds(phoneNumber).includes(nextAgentId)
                );
                setSelectedFromPhone(nextPhone?.phone_number ?? "");
              }}
              setSelectedFromPhone={setSelectedFromPhone}
              dispatchError={dispatchError}
              onDismissDispatchError={() => setDispatchError(null)}
              onSubmit={submit}
            />
          ) : (
            <RetellConnectionGuide connectionState={connectionState} issues={issues} />
          )
        ) : isComplete ? (
          <CompleteCard
            task={task}
            transcriptWords={transcriptWords}
            visibleWords={visibleWords}
            onReset={() => {
              setCurrentTaskId(null);
              setStatus((current) => ({ ...current, task: null }));
              setStartedAt(null);
            }}
          />
        ) : (
          <CallingCard
            task={task}
            elapsedSeconds={elapsedSeconds}
            pending={pending}
            canCancel={Boolean(task && activeStatuses.has(task.status))}
            onCancel={cancelCurrentCall}
          />
        )}

        <RecentCallsStrip recent={status.recent} />
      </main>
    </div>
  );
}

function TestCallForm({
  defaultPhone,
  demoScenarios,
  selectedScenario,
  setSelectedScenario,
  isCustom,
  pending,
  agents,
  linkedPhoneNumbers,
  selectedAgentId,
  selectedFromPhone,
  setSelectedAgentId,
  setSelectedFromPhone,
  dispatchError,
  onDismissDispatchError,
  onSubmit,
}: {
  defaultPhone: string;
  demoScenarios: TestScenario[];
  selectedScenario: TestCallScenarioId;
  setSelectedScenario: (scenario: TestCallScenarioId) => void;
  isCustom: boolean;
  pending: boolean;
  agents: RetellConnectionAgent[];
  linkedPhoneNumbers: RetellConnectionPhoneNumber[];
  selectedAgentId: string;
  selectedFromPhone: string;
  setSelectedAgentId: (agentId: string) => void;
  setSelectedFromPhone: (phoneNumber: string) => void;
  dispatchError: string | null;
  onDismissDispatchError: () => void;
  onSubmit: (formData: FormData) => void;
}) {
  return (
    <Card elevation="raised" padding="comfortable" className="gap-6">
      <div className="rounded-xl border border-info-border bg-info-bg p-3 text-sm text-info-fg">
        This call is encrypted end-to-end and not stored after analysis. Retention is configurable in settings.
      </div>
      <form action={onSubmit} className="grid gap-6">
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="grid gap-1">
            <span className="text-sm font-medium">Which agent?</span>
            <select
              value={selectedAgentId}
              required
              className="h-9 rounded-lg border bg-background px-2 text-sm"
              onChange={(event) => setSelectedAgentId(event.target.value)}
            >
              {agents.map((agent) => (
                <option key={agent.agent_id} value={agent.agent_id}>
                  {retellAgentName(agent)}
                </option>
              ))}
            </select>
          </label>
          <label className="grid gap-1">
            <span className="text-sm font-medium">Which from-number?</span>
            <select
              value={selectedFromPhone}
              required
              className="h-9 rounded-lg border bg-background px-2 text-sm"
              onChange={(event) => setSelectedFromPhone(event.target.value)}
            >
              <option value="" disabled>
                Select a number linked to this agent
              </option>
              {linkedPhoneNumbers.map((phoneNumber) => (
                <option key={phoneNumber.phone_number} value={phoneNumber.phone_number}>
                  {phoneNumber.nickname
                    ? `${phoneNumber.nickname} (${phoneNumber.phone_number})`
                    : phoneNumber.phone_number}
                </option>
              ))}
            </select>
          </label>
        </div>
        <Input
          name="phone"
          label="Phone number"
          defaultValue={defaultPhone}
          placeholder="(313) 555-0101"
          required
          prefix={<span className="text-base" aria-hidden="true">🇺🇸</span>}
          description="US default. Include area code; we'll normalize it before dialing."
        />

        <div className="grid gap-3 rounded-xl border border-border-default bg-bg-surface-sunken p-4">
          <div>
            <p className="text-sm font-semibold">Template dynamic fields</p>
            <p className="mt-1 text-xs text-fg-tertiary">
              These values fill Retell placeholders like {"{{recipient_first_name}}"} during the test call.
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            {testDynamicVariableFields.map((field) => (
              <Input
                key={field.key}
                name={`dynamic_variable__${field.key}`}
                label={field.label}
                defaultValue={
                  field.key === "recipient_phone" ? defaultPhone : field.defaultValue
                }
                placeholder={field.key}
              />
            ))}
          </div>
        </div>

        <div className="grid gap-3">
          <p className="text-sm font-semibold">Pick a scenario</p>
          <div className="grid gap-3 sm:grid-cols-2">
            {demoScenarios.map((scenario) => {
              const meta = scenarioMeta[scenario.id] ?? scenarioMeta.custom;
              const Icon = meta.icon;
              const selected = selectedScenario === scenario.id;
              return (
                <button
                  key={scenario.id}
                  type="button"
                  onClick={() => setSelectedScenario(scenario.id)}
                  className={cn(
                    "min-h-28 rounded-xl border border-border-default bg-bg-surface p-4 text-left shadow-xs transition-all duration-base hover:-translate-y-0.5 hover:border-border-strong hover:shadow-md focus-visible:shadow-focus",
                    selected &&
                      "border-accent-secondary bg-[color-mix(in_oklch,var(--color-accent-secondary)_5%,transparent)] ring-2 ring-accent-secondary"
                  )}
                >
                  <Icon className="mb-3 size-5 text-accent-primary" />
                  <p className="text-sm font-semibold text-fg-primary">{meta.title}</p>
                  <p className="mt-1 text-xs leading-normal text-fg-secondary">{meta.description}</p>
                </button>
              );
            })}
          </div>
        </div>

        {isCustom ? (
          <Textarea
            name="custom_script_variables"
            label="Custom script variables"
            defaultValue={'{\n  "scenario_description": "a custom test caller",\n  "caller_goal": "stress test the intake agent"\n}'}
            className="min-h-36 font-mono text-xs"
          />
        ) : null}

        <label className="flex items-center gap-2 text-sm text-fg-secondary">
          <input type="checkbox" name="save_default_phone" className="size-4" />
          Save as my default test phone
        </label>

        {!selectedAgentId || !selectedFromPhone ? (
          <p className="rounded-lg border border-danger-border bg-danger-bg p-3 text-sm text-danger-fg">
            Select a Retell agent and a phone number linked to that agent before placing a test call.
          </p>
        ) : null}

        <Button
          type="submit"
          disabled={pending || !selectedAgentId || !selectedFromPhone}
          className="group h-12 w-full text-base"
          iconLeft={<PhoneCallIcon className="transition-transform group-hover:animate-phone-ring" />}
        >
          {pending ? "Calling your phone..." : "Call my phone now"}
        </Button>
      </form>
      {dispatchError ? (
        <Alert variant="danger">
          <AlertTitle>Couldn&apos;t place the test call</AlertTitle>
          <AlertDescription className="grid gap-3">
            <p>{dispatchError}</p>
            <Button
              variant="secondary"
              size="sm"
              className="w-fit"
              render={<Link href="/dashboard/setup" />}
            >
              Run setup checks
            </Button>
          </AlertDescription>
          <AlertAction>
            <Button
              type="button"
              variant="ghost"
              size="icon-xs"
              aria-label="Dismiss diagnostic"
              onClick={onDismissDispatchError}
            >
              <XIcon />
            </Button>
          </AlertAction>
        </Alert>
      ) : null}
    </Card>
  );
}

function CallingCard({
  task,
  elapsedSeconds,
  pending,
  canCancel,
  onCancel,
}: {
  task: TestTask | null;
  elapsedSeconds: number;
  pending: boolean;
  canCancel: boolean;
  onCancel: () => void;
}) {
  const statusText =
    task?.status === "in_progress"
      ? `Conversation in progress (${formatDuration(elapsedSeconds)})`
      : task?.status === "completed"
        ? "Call ended - preparing transcript and extraction"
        : task?.status === "queued" || task?.status === "scheduled"
          ? "Dialing your number..."
          : task?.status
            ? `Status: ${task.status}`
            : "Dialing your number...";

  return (
    <Card elevation="raised" padding="comfortable" className="items-center text-center">
      <div className="relative grid size-24 place-items-center rounded-full bg-bg-emphasis">
        <span className="absolute inset-0 animate-ping rounded-full bg-accent-secondary/20" />
        <PhoneIncomingIcon className="relative size-10 animate-phone-ring text-accent-primary" />
      </div>
      <div>
        <h2 className="text-2xl font-semibold">Calling...</h2>
        <p className="mt-2 text-base text-fg-secondary">{statusText}</p>
        <span className="mt-2 inline-flex items-center gap-1" aria-label="Polling live status">
          <span className="thinking-dot size-1.5 rounded-full bg-accent-secondary" />
          <span className="thinking-dot size-1.5 rounded-full bg-accent-secondary [animation-delay:120ms]" />
          <span className="thinking-dot size-1.5 rounded-full bg-accent-secondary [animation-delay:240ms]" />
        </span>
      </div>
      <div className="grid w-full gap-3 rounded-xl border border-border-subtle bg-bg-surface-sunken p-4 sm:grid-cols-3">
        <Metric label="Live duration" value={formatDuration(elapsedSeconds)} />
        <Metric label="Estimated wait" value={elapsedSeconds < 10 ? "~5 sec" : "Webhook pending"} />
        <Metric label="Task" value={task?.status ?? "queued"} />
      </div>
      {canCancel ? (
        <Button variant="destructive" disabled={pending} onClick={onCancel}>
          <PhoneOffIcon />
          Cancel call
        </Button>
      ) : (
        <p className="text-sm text-fg-tertiary">
          Call ended. Waiting for Retell transcript and extraction artifacts.
        </p>
      )}
    </Card>
  );
}

function CompleteCard({
  task,
  transcriptWords,
  visibleWords,
  onReset,
}: {
  task: TestTask | null;
  transcriptWords: string[];
  visibleWords: number;
  onReset: () => void;
}) {
  const extraction = extractionRecord(task?.extraction);
  const intakeFields = extractionRecord(extraction.intake_fields);

  return (
    <div className="grid gap-5">
      <Card elevation="raised" padding="comfortable" className="items-center text-center">
        <CheckIconCircle />
        <div>
          <h2 className="text-2xl font-semibold">Call complete</h2>
          <p className="mt-2 text-sm text-fg-secondary">
            Transcript and extraction are available below.
          </p>
        </div>
        <div className="flex flex-wrap justify-center gap-3">
          {task?.call_href ? (
            <Button render={<Link href={task.call_href} />}>View transcript</Button>
          ) : (
            <Button disabled>Transcript pending</Button>
          )}
          {task?.lead_href ? (
            <Button variant="secondary" render={<Link href={task.lead_href} />}>
              View extracted lead
            </Button>
          ) : (
            <Button variant="secondary" disabled>
              Lead pending
            </Button>
          )}
          <Button variant="tertiary" onClick={onReset}>
            Run another test
          </Button>
        </div>
      </Card>

      <Card padding="compact">
        <div className="flex items-center gap-2">
          <MicIcon className="size-4 text-accent-primary" />
          <h3 className="font-semibold">Live transcript preview</h3>
        </div>
        <p className="min-h-28 text-sm leading-relaxed text-fg-secondary">
          {transcriptWords.slice(0, visibleWords).join(" ")}
          {visibleWords < transcriptWords.length ? <span className="animate-pulse"> ▍</span> : null}
        </p>
      </Card>

      <Card padding="compact">
        <div className="flex items-center gap-2">
          <FileTextIcon className="size-4 text-accent-primary" />
          <h3 className="font-semibold">Structured extraction preview</h3>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <ReadOnlyField label="Name" value={stringValue(extraction.client_name ?? extraction.name)} />
          <ReadOnlyField label="Payer" value={stringValue(extraction.primary_payer ?? extraction.payer)} />
          <ReadOnlyField label="Urgency" value={stringValue(extraction.urgency)} />
          <ReadOnlyField label="Outcome" value={displayValue(intakeFields.outcome)} />
          <ReadOnlyField label="Callback requested" value={displayValue(intakeFields.callback_time_requested)} />
          <ReadOnlyField label="Requested services" value={displayValue(intakeFields.requested_services)} />
          <ReadOnlyField label="Callback time" value={displayValue(intakeFields.preferred_callback_time)} />
          <ReadOnlyField label="Next action" value={displayValue(intakeFields.next_action_recommendation)} />
          <ReadOnlyField label="Summary" value={stringValue(extraction.summary, "Extraction pending")} />
        </div>
      </Card>
    </div>
  );
}

function RecentCallsStrip({ recent }: { recent: TestTask[] }) {
  return (
    <section className="grid gap-3">
      <h2 className="font-heading text-lg font-semibold">Your recent test calls</h2>
      <div className="flex snap-x gap-3 overflow-x-auto pb-2">
        {recent.map((item) => {
          const extraction = extractionRecord(item.extraction);
          return (
            <Card
              key={item.id}
              padding="compact"
              className="min-w-72 snap-start gap-3"
            >
              <div className="flex items-center justify-between gap-2">
                <Badge variant="neutral">{item.scenario}</Badge>
                <span className="text-xs text-fg-tertiary">
                  {item.duration_seconds ? formatDuration(item.duration_seconds) : item.status}
                </span>
              </div>
              <p className="line-clamp-2 text-sm text-fg-secondary">
                {stringValue(extraction.summary, item.disposition ?? "Awaiting extraction summary.")}
              </p>
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs text-fg-tertiary">{formatDate(item.created_at)}</span>
                {item.call_href ? (
                  <Button variant="secondary" size="sm" render={<Link href={item.call_href} />}>
                    View
                    <ChevronRightIcon />
                  </Button>
                ) : null}
              </div>
            </Card>
          );
        })}
        {recent.length === 0 ? (
          <Card padding="compact" className="min-w-72 text-sm text-fg-tertiary">
            Call your phone now to see the transcript and extraction appear here.
          </Card>
        ) : null}
      </div>
    </section>
  );
}

function TipsRail({ tip }: { tip: string }) {
  return (
    <aside className="fixed right-6 top-28 hidden w-72 xl:block">
      <Card elevation="raised" padding="compact" className="gap-3">
        <div className="flex items-center gap-2">
          <CircleHelpIcon className="size-5 text-accent-primary" />
          <h2 className="font-semibold">Tips</h2>
        </div>
        <p className="text-sm leading-normal text-fg-secondary">{tip}</p>
        <div className="flex gap-1">
          {tips.map((item) => (
            <span
              key={item}
              className={cn("h-1 flex-1 rounded-full bg-bg-muted", item === tip && "bg-accent-secondary")}
            />
          ))}
        </div>
      </Card>
    </aside>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs font-medium tracking-wide text-fg-tertiary uppercase">{label}</p>
      <p className="mt-1 font-mono text-lg font-semibold tabular-nums">{value}</p>
    </div>
  );
}

function ReadOnlyField({ label, value }: { label: string; value: string }) {
  return (
    <label className="grid gap-1">
      <span className="text-xs font-medium tracking-wide text-fg-tertiary uppercase">{label}</span>
      <span className="rounded-md border border-border-default bg-bg-surface-sunken px-3 py-2 text-sm">
        {value}
      </span>
    </label>
  );
}

function CheckIconCircle() {
  return (
    <div className="grid size-20 place-items-center rounded-full bg-success-bg">
      <SparklesIcon className="size-9 text-success-fg" />
    </div>
  );
}
