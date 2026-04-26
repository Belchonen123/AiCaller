import Link from "next/link";
import { headers } from "next/headers";
import {
  CheckIcon,
  CircleDashedIcon,
  ExternalLinkIcon,
  PhoneIcon,
  SparklesIcon,
  XIcon,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { PageHeader } from "@/components/page-header";
import { getCurrentUser } from "@/lib/auth";
import { checkRequiredEnv } from "@/lib/env-check";
import { getRetellPhoneNumberAgentIds } from "@/lib/retell/connection-state";
import {
  loadRetellSetupStatus,
  type SetupStepState,
} from "@/lib/retell/setup-status";
import { CopyButton, GenerateSecretButton } from "@/app/dashboard/setup/setup-actions";

function getAppUrl(host: string | null, proto: string | null) {
  if (process.env.NEXT_PUBLIC_APP_URL) {
    return process.env.NEXT_PUBLIC_APP_URL.replace(/\/$/, "");
  }

  return host ? `${proto ?? "https"}://${host}` : "http://localhost:3000";
}

function StateIcon({ state }: { state: SetupStepState }) {
  if (state === "complete") {
    return (
      <span className="grid size-8 place-items-center rounded-full bg-success-bg text-success-fg">
        <CheckIcon className="size-4" />
      </span>
    );
  }

  if (state === "pending") {
    return (
      <span className="grid size-8 place-items-center rounded-full bg-warning-bg text-warning-fg">
        <CircleDashedIcon className="size-4 animate-spin" />
      </span>
    );
  }

  return (
    <span className="grid size-8 place-items-center rounded-full bg-danger-bg text-danger-fg">
      <XIcon className="size-4" />
    </span>
  );
}

function StepCard({
  number,
  title,
  state,
  complete,
  incomplete,
}: {
  number: number;
  title: string;
  state: SetupStepState;
  complete: React.ReactNode;
  incomplete: React.ReactNode;
}) {
  return (
    <Card padding="comfortable" elevation="raised" className="gap-4">
      <div className="flex items-start gap-3">
        <span className="grid size-9 shrink-0 place-items-center rounded-full bg-bg-emphasis font-semibold text-fg-on-emphasis">
          {number}
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="font-heading text-lg font-semibold">{title}</h2>
          <div className="mt-2 text-sm text-fg-secondary">
            {state === "complete" ? complete : incomplete}
          </div>
        </div>
        <StateIcon state={state} />
      </div>
    </Card>
  );
}

function HealthItem({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-border-subtle bg-bg-surface-sunken p-3">
      <p className="text-xs font-medium tracking-wide text-fg-tertiary uppercase">{label}</p>
      <div className="mt-1 text-sm font-medium">{value}</div>
    </div>
  );
}

function formatDuration(seconds: number | null) {
  if (!seconds) {
    return "Duration unavailable";
  }

  const minutes = Math.floor(seconds / 60);
  const remaining = seconds % 60;
  return `${minutes}:${String(remaining).padStart(2, "0")}`;
}

export default async function SetupPage() {
  const current = await getCurrentUser();
  const requestHeaders = await headers();
  const appUrl = getAppUrl(
    requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host"),
    requestHeaders.get("x-forwarded-proto")
  );
  const setup = await loadRetellSetupStatus({
    tenantId: current.profile.tenant_id,
    appUrl,
  });
  const envStatus = checkRequiredEnv();
  const hasEnvIssues =
    envStatus.missing.length > 0 || envStatus.misconfigured.length > 0;

  return (
    <div className="grid gap-5">
      <PageHeader
        eyebrow="Configuration"
        title="Setup"
        description="Connect Retell in order and verify each step with live checks."
      />

      {hasEnvIssues ? (
        <Alert variant="danger">
          <AlertTitle>Environment variables need attention</AlertTitle>
          <AlertDescription>
            {envStatus.missing.length > 0 ? (
              <div>
                <p className="font-medium">Missing</p>
                <ul className="mt-1 list-disc pl-5">
                  {envStatus.missing.map((item) => (
                    <li key={item}>
                      <code>{item}</code>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
            {envStatus.misconfigured.length > 0 ? (
              <div className="mt-3">
                <p className="font-medium">Misconfigured</p>
                <ul className="mt-1 list-disc pl-5">
                  {envStatus.misconfigured.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </div>
            ) : null}
          </AlertDescription>
        </Alert>
      ) : null}

      {setup.allComplete ? (
        <Card
          elevation="raised"
          padding="comfortable"
          className="border-success-border bg-success-bg text-success-fg"
        >
          <div className="flex items-center gap-3">
            <SparklesIcon className="size-7" />
            <div>
              <h2 className="font-heading text-xl font-semibold">
                You&apos;re connected. Place test calls or start campaigns.
              </h2>
              <p className="mt-1 text-sm">All Retell setup checks are complete.</p>
            </div>
          </div>
        </Card>
      ) : null}

      <Card padding="comfortable" elevation="raised" className="gap-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="font-heading text-lg font-semibold">Connection health</h2>
            <p className="text-sm text-fg-secondary">Live Retell and webhook setup status.</p>
          </div>
          <Badge variant={setup.allComplete ? "success" : "warning"} dot>
            {setup.allComplete ? "Ready" : "Setup needed"}
          </Badge>
        </div>
        <div className="grid gap-3 md:grid-cols-3">
          <HealthItem
            label="Retell API"
            value={setup.apiReachable ? "reachable" : "not reachable"}
          />
          <HealthItem
            label="Webhook URL"
            value={
              <span className="flex flex-wrap items-center gap-2">
                <code className="break-all font-mono text-xs">{setup.webhookUrl}</code>
                <CopyButton value={setup.webhookUrl} />
              </span>
            }
          />
          <HealthItem
            label="Webhook secret"
            value={setup.webhookSecretConfigured ? "configured" : "not configured"}
          />
          <HealthItem label="Total agents" value={setup.agents.length} />
          <HealthItem label="Total numbers" value={setup.phoneNumbers.length} />
          <HealthItem label="Linked pairs" value={setup.linkedPairs} />
        </div>
      </Card>

      <div className="grid gap-4">
        <StepCard
          number={1}
          title="Set RETELL_API_KEY environment variable"
          state={setup.steps.apiKey}
          complete={
            <p>
              <span className="font-medium text-success-fg">Connected</span>{" "}
              {setup.maskedApiKey ? <code>{setup.maskedApiKey}</code> : null}
            </p>
          }
          incomplete={
            <div className="grid gap-3">
              <p>Get key from Retell dashboard → Settings → API Keys.</p>
              <p>Add to Vercel Environment Variables → redeploy.</p>
              <Button
                className="w-fit"
                render={
                  <a href="https://dashboard.retellai.com/api-keys" target="_blank" rel="noreferrer" />
                }
              >
                Open Retell dashboard
                <ExternalLinkIcon />
              </Button>
            </div>
          }
        />

        <StepCard
          number={2}
          title="Set RETELL_WEBHOOK_SECRET"
          state={setup.steps.webhookSecret}
          complete={<p>Webhook secret is configured.</p>}
          incomplete={
            <div className="grid gap-3">
              <p>
                Add this to BOTH your Vercel env AND each agent&apos;s webhook config in
                Retell.
              </p>
              <GenerateSecretButton />
            </div>
          }
        />

        <StepCard
          number={3}
          title="Buy at least one phone number in Retell"
          state={setup.steps.phoneNumber}
          complete={<p>{setup.phoneNumbers.length} phone number(s) found.</p>}
          incomplete={
            <Button
              className="w-fit"
              render={
                <a href="https://dashboard.retellai.com/phone-numbers" target="_blank" rel="noreferrer" />
              }
            >
              Open phone numbers
              <ExternalLinkIcon />
            </Button>
          }
        />

        <StepCard
          number={4}
          title="Import at least one agent template"
          state={setup.steps.agent}
          complete={<p>{setup.agents.length} agent(s) found.</p>}
          incomplete={
            <Button className="w-fit" render={<Link href="/dashboard/agents" />}>
              Open agents
            </Button>
          }
        />

        <StepCard
          number={5}
          title="Link a phone number to an agent"
          state={setup.steps.linkedPair}
          complete={<p>{setup.linkedPairs} linked phone/agent pair(s) found.</p>}
          incomplete={
            <div className="grid gap-3">
              <p>
                In Retell dashboard, edit a phone number and select the agent it should
                use.
              </p>
              <div className="overflow-x-auto rounded-lg border border-border-default">
                <table className="w-full text-left text-sm">
                  <thead className="bg-bg-surface-sunken text-xs text-fg-tertiary uppercase">
                    <tr>
                      <th className="p-2">Phone number</th>
                      <th className="p-2">Nickname</th>
                      <th className="p-2">Linked agent ID</th>
                    </tr>
                  </thead>
                  <tbody>
                    {setup.phoneNumbers.map((phoneNumber) => (
                      <tr key={phoneNumber.phone_number} className="border-t border-border-subtle">
                        <td className="p-2 font-mono text-xs">{phoneNumber.phone_number}</td>
                        <td className="p-2">{phoneNumber.nickname ?? ""}</td>
                        <td className="p-2 font-mono text-xs">
                          {getRetellPhoneNumberAgentIds(phoneNumber).join(", ") || "Not linked"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          }
        />

        <StepCard
          number={6}
          title="Configure webhook URL on each agent"
          state={setup.steps.webhookConfigured}
          complete={<p>Checked agents have the correct webhook URL.</p>}
          incomplete={
            <div className="grid gap-3">
              <p>
                Set each agent&apos;s webhook URL to{" "}
                <code className="break-all font-mono text-xs">{setup.webhookUrl}</code>.
              </p>
              <CopyButton value={setup.webhookUrl} label="Copy webhook URL" />
              <div className="grid gap-2">
                {setup.agentWebhookStatuses
                  .filter((agent) => !agent.complete)
                  .map((agent) => (
                    <div
                      key={agent.agent_id}
                      className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border-default p-3"
                    >
                      <div>
                        <p className="font-medium">{agent.agent_name}</p>
                        <p className="font-mono text-xs text-fg-tertiary">{agent.agent_id}</p>
                        <p className="mt-1 text-xs text-fg-secondary">
                          Current webhook: {agent.webhook_url ?? "Not configured"}
                        </p>
                      </div>
                      <Button
                        variant="secondary"
                        size="sm"
                        render={
                          <a
                            href={`https://dashboard.retellai.com/agents/${agent.agent_id}`}
                            target="_blank"
                            rel="noreferrer"
                          />
                        }
                      >
                        Open agent in Retell
                        <ExternalLinkIcon />
                      </Button>
                    </div>
                  ))}
              </div>
            </div>
          }
        />

        <StepCard
          number={7}
          title="Place a test call"
          state={setup.steps.testCall}
          complete={
            <div className="grid gap-2">
              <p>Last test call found.</p>
              {setup.lastCall ? (
                <div className="rounded-lg border border-border-subtle bg-bg-surface-sunken p-3 text-sm">
                  <p>
                    <span className="font-medium">Call:</span>{" "}
                    <Link className="text-fg-link" href={`/dashboard/calls/${setup.lastCall.id}`}>
                      {setup.lastCall.id}
                    </Link>
                  </p>
                  <p>
                    <span className="font-medium">Duration:</span>{" "}
                    {formatDuration(setup.lastCall.duration_seconds)}
                  </p>
                  <p>
                    <span className="font-medium">Transcript:</span>{" "}
                    {setup.lastCall.transcript ? "available" : "pending"}
                  </p>
                </div>
              ) : null}
            </div>
          }
          incomplete={
            <Button className="w-fit" render={<Link href="/dashboard/test-call" />}>
              <PhoneIcon />
              Place a test call
            </Button>
          }
        />
      </div>
    </div>
  );
}
