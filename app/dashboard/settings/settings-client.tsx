"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  cancelAllRunningCampaigns,
  inviteStaff,
  removeStaff,
  updateAgencyInfo,
  updateStaffRole,
} from "@/app/dashboard/settings/actions";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getRetellPhoneNumberAgentIds } from "@/lib/retell/connection-state";

type StaffMember = {
  id: string;
  full_name: string | null;
  email: string;
  role: string;
};

type RetellStatus = {
  configured: boolean;
  reachable: boolean;
  agentName: string | null;
  phoneNumber: string | null;
};

type SettingsClientProps = {
  tenant: {
    name: string;
    agency_phone: string | null;
    agency_address: string | null;
  };
  staff: StaffMember[];
  currentRole: string;
  webhookUrl: string;
  retellStatus: RetellStatus;
  outboundCalling: {
    retellAgentId: string | null;
    phoneNumbers: Array<{
      phone_number: string;
      nickname?: string;
      agent_id?: string;
      inbound_agent_id?: string;
      outbound_agent_id?: string;
      agent_ids?: string[];
      inbound_agent_ids?: string[];
      outbound_agent_ids?: string[];
    }>;
    agents: Array<{
      agent_id: string;
      agent_name?: string | null;
      agentName?: string | null;
      name?: string | null;
      voice_id?: string | null;
      voice?: string | null;
      llm_id?: string | null;
      llm?: string | null;
      model?: string | null;
    }>;
    dispatcher: {
      active: boolean;
      queuedTasks: number;
      inProgressTasks: number;
      lastRunAt: string | null;
    };
  };
};

const roles = ["admin", "intake", "scheduler", "hr", "staff"] as const;
const baaPartners = [
  ["Retell", "https://docs.retellai.com/"],
  ["Supabase", "https://supabase.com/security"],
  ["Vercel", "https://vercel.com/security"],
  ["Anthropic", "https://trust.anthropic.com/"],
  ["Paubox", "https://www.paubox.com/hipaa-compliance"],
] as const;

export function SettingsClient({
  tenant,
  staff,
  currentRole,
  webhookUrl,
  retellStatus,
  outboundCalling,
}: SettingsClientProps) {
  const [pending, startTransition] = useTransition();
  const [copied, setCopied] = useState(false);
  const [dangerOpen, setDangerOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const router = useRouter();
  const isOwner = currentRole === "owner";

  function run(action: () => Promise<{ ok: boolean; message: string }>) {
    startTransition(async () => {
      const result = await action();
      if (result.ok) {
        toast.success(result.message);
      } else {
        toast.error(result.message);
      }
    });
  }

  function formatDate(value: string | null) {
    if (!value) {
      return "Never";
    }

    return new Intl.DateTimeFormat("en-US", {
      dateStyle: "short",
      timeStyle: "short",
    }).format(new Date(value));
  }

  function agentName(agent: SettingsClientProps["outboundCalling"]["agents"][number]) {
    return agent.agent_name ?? agent.agentName ?? agent.name ?? "Unnamed agent";
  }

  function agentVoice(agent: SettingsClientProps["outboundCalling"]["agents"][number]) {
    return agent.voice ?? agent.voice_id ?? "Unavailable";
  }

  function agentLlm(agent: SettingsClientProps["outboundCalling"]["agents"][number]) {
    return agent.llm ?? agent.llm_id ?? agent.model ?? "Unavailable";
  }

  return (
    <div className="grid gap-4">
      <Card className="p-4">
        <h2 className="mb-1 text-base font-semibold">Agency information</h2>
        <p className="mb-3 text-sm text-fg-secondary">
          Update the tenant identity displayed across the intake workspace.
        </p>
        <form
          className="grid gap-3 md:grid-cols-3"
          action={(formData) =>
            run(() =>
              updateAgencyInfo({
                name: formData.get("name"),
                agency_phone: formData.get("agency_phone"),
                agency_address: formData.get("agency_address"),
              })
            )
          }
        >
          <label className="grid gap-1">
            <Label>Name</Label>
            <Input name="name" defaultValue={tenant.name} required />
          </label>
          <label className="grid gap-1">
            <Label>Phone</Label>
            <Input name="agency_phone" defaultValue={tenant.agency_phone ?? ""} />
          </label>
          <label className="grid gap-1">
            <Label>Address</Label>
            <Input
              name="agency_address"
              defaultValue={tenant.agency_address ?? ""}
            />
          </label>
          <Button disabled={pending} type="submit" className="md:w-fit">
            Save agency info
          </Button>
        </form>
      </Card>

      <Card className="p-4">
        <h2 className="mb-1 text-base font-semibold">Team members</h2>
        <p className="mb-3 text-sm text-fg-secondary">
          Invite teammates by email and assign least-privilege roles.
        </p>
        <form
          className="mb-4 grid gap-3 md:grid-cols-[1fr_12rem_auto]"
          action={(formData) =>
            run(() =>
              inviteStaff({
                email: formData.get("email"),
                role: formData.get("role"),
              })
            )
          }
        >
          <Input name="email" type="email" placeholder="staff@example.com" required />
          <select name="role" className="h-8 rounded-lg border bg-background px-2 text-sm">
            {roles.map((role) => (
              <option key={role} value={role}>
                {role}
              </option>
            ))}
          </select>
          <Button disabled={pending} type="submit">
            Invite by email
          </Button>
        </form>
        <div className="grid gap-2">
          {staff.map((member) => (
            <div
              key={member.id}
              className="grid gap-2 rounded-lg border border-border-default p-3 md:grid-cols-[1fr_12rem_auto]"
            >
              <div>
                <p className="font-medium">{member.full_name || member.email}</p>
                <p className="text-sm text-muted-foreground">{member.email}</p>
              </div>
              <select
                value={member.role}
                className="h-8 rounded-lg border bg-background px-2 text-sm"
                onChange={(event) =>
                  run(() =>
                    updateStaffRole({
                      id: member.id,
                      role: event.target.value,
                    })
                  )
                }
              >
                {[...(isOwner ? ["owner"] : []), ...roles].map((role) => (
                  <option key={role} value={role}>
                    {role}
                  </option>
                ))}
              </select>
              <Button
                type="button"
                variant="outline"
                disabled={!isOwner || pending}
                onClick={() => run(() => removeStaff({ id: member.id }))}
              >
                Remove
              </Button>
            </div>
          ))}
        </div>
      </Card>

      <Card className="grid gap-3 p-4">
        <h2 className="text-base font-semibold">Retell connection status</h2>
        <p className="text-sm text-fg-secondary">
          Managed in the Retell dashboard. Verify reachability, linked agent identity, and webhook configuration.
        </p>
        <dl className="grid gap-2 text-sm md:grid-cols-2">
          <div>
            <dt className="text-fg-tertiary">Configured</dt>
            <dd>{retellStatus.configured ? "Yes" : "No"}</dd>
          </div>
          <div>
            <dt className="text-fg-tertiary">Reachable</dt>
            <dd>{retellStatus.reachable ? "Yes" : "No"}</dd>
          </div>
          <div>
            <dt className="text-fg-tertiary">Agent name</dt>
            <dd>{retellStatus.agentName ?? "Unavailable"}</dd>
          </div>
          <div>
            <dt className="text-fg-tertiary">Primary phone number</dt>
            <dd>{retellStatus.phoneNumber ?? "Unavailable"}</dd>
          </div>
        </dl>
        <div className="flex flex-wrap items-center gap-2 rounded-lg border border-border-default bg-bg-surface-sunken p-3">
          <code className="break-all font-mono text-xs text-fg-secondary">{webhookUrl}</code>
          <Button
            variant="secondary"
            size="sm"
            onClick={async () => {
              await navigator.clipboard.writeText(webhookUrl);
              setCopied(true);
            }}
          >
            {copied ? "Copied" : "Copy webhook URL"}
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={() => router.refresh()}>
            Test connection
          </Button>
        </div>
      </Card>

      <Card className="grid gap-4 p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold">Outbound calling status</h2>
            <p className="text-sm text-fg-secondary">
              Read-only Retell configuration and dispatcher status. Edit Retell
              configuration in Vercel env vars or the Retell dashboard.
            </p>
          </div>
          <Button type="button" variant="outline" onClick={() => router.refresh()}>
            Sync from Retell
          </Button>
        </div>

        <section className="grid gap-3 md:grid-cols-4">
          <div className="rounded-lg border p-3">
            <p className="text-xs text-muted-foreground">Outbound dispatcher</p>
            <p className="font-medium">
              {outboundCalling.dispatcher.active ? "Active" : "Idle"}
            </p>
          </div>
          <div className="rounded-lg border p-3">
            <p className="text-xs text-muted-foreground">Tasks in queue</p>
            <p className="font-medium">{outboundCalling.dispatcher.queuedTasks}</p>
          </div>
          <div className="rounded-lg border p-3">
            <p className="text-xs text-muted-foreground">Tasks in progress</p>
            <p className="font-medium">{outboundCalling.dispatcher.inProgressTasks}</p>
          </div>
          <div className="rounded-lg border p-3">
            <p className="text-xs text-muted-foreground">Last dispatcher run</p>
            <p className="font-medium">{formatDate(outboundCalling.dispatcher.lastRunAt)}</p>
          </div>
        </section>

        <section className="grid gap-2">
          <h3 className="text-sm font-semibold">Linked Retell phone numbers</h3>
          <div className="overflow-x-auto rounded-lg border">
            <table className="w-full min-w-[700px] text-sm">
              <thead className="border-b bg-muted/50 text-left text-xs text-muted-foreground">
                <tr>
                  <th className="p-2">Phone number</th>
                  <th className="p-2">Nickname</th>
                  <th className="p-2">Linked agent ID</th>
                  <th className="p-2">Current env agent</th>
                </tr>
              </thead>
              <tbody>
                {outboundCalling.phoneNumbers.map((phoneNumber) => (
                  <tr key={phoneNumber.phone_number} className="border-b">
                    <td className="p-2 font-mono text-xs">{phoneNumber.phone_number}</td>
                    <td className="p-2">{phoneNumber.nickname ?? ""}</td>
                    <td className="p-2 font-mono text-xs">
                      {getRetellPhoneNumberAgentIds(phoneNumber).join(", ")}
                    </td>
                    <td className="p-2">
                      {outboundCalling.retellAgentId &&
                      getRetellPhoneNumberAgentIds(phoneNumber).includes(
                        outboundCalling.retellAgentId
                      )
                        ? "Yes"
                        : ""}
                    </td>
                  </tr>
                ))}
                {outboundCalling.phoneNumbers.length === 0 ? (
                  <tr>
                    <td className="p-4 text-center text-muted-foreground" colSpan={4}>
                      Connect a Retell number to place outbound campaigns from this workspace.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </section>

        <section className="grid gap-2">
          <h3 className="text-sm font-semibold">Linked Retell agents</h3>
          <div className="overflow-x-auto rounded-lg border">
            <table className="w-full min-w-[700px] text-sm">
              <thead className="border-b bg-muted/50 text-left text-xs text-muted-foreground">
                <tr>
                  <th className="p-2">Agent ID</th>
                  <th className="p-2">Agent name</th>
                  <th className="p-2">Voice</th>
                  <th className="p-2">LLM</th>
                </tr>
              </thead>
              <tbody>
                {outboundCalling.agents.map((agent) => (
                  <tr key={agent.agent_id} className="border-b">
                    <td className="p-2 font-mono text-xs">{agent.agent_id}</td>
                    <td className="p-2">{agentName(agent)}</td>
                    <td className="p-2">{agentVoice(agent)}</td>
                    <td className="p-2">{agentLlm(agent)}</td>
                  </tr>
                ))}
                {outboundCalling.agents.length === 0 ? (
                  <tr>
                    <td className="p-4 text-center text-muted-foreground" colSpan={4}>
                      Link a Retell agent to unlock live calls, test scenarios, and extraction review.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </section>
      </Card>

      <Card className="grid gap-4 p-4">
        <div>
          <h2 className="text-base font-semibold">Compliance</h2>
          <p className="mt-1 text-sm text-fg-secondary">
            Business associate agreements are signed with subprocessors before PHI touches the workflow.
          </p>
        </div>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
          {baaPartners.map(([name, href]) => (
            <a
              key={name}
              href={href}
              target="_blank"
              rel="noreferrer"
              className="rounded-xl border border-border-default bg-bg-surface-sunken p-3 text-sm font-semibold text-fg-primary transition-colors hover:bg-bg-muted focus-visible:shadow-focus"
              aria-label={`${name} HIPAA documentation`}
            >
              <span className="block text-lg">{name}</span>
              <span className="mt-1 block text-xs font-normal text-fg-tertiary">BAA signed · HIPAA docs</span>
            </a>
          ))}
        </div>
        <p className="text-sm text-fg-secondary">
          Data retention: tenant data is retained until contract termination or owner-approved deletion.
        </p>
      </Card>

      <Card className="grid gap-3 p-4">
        <h2 className="text-base font-semibold">Data Export</h2>
        <p className="text-sm text-muted-foreground">
          Owner-only full tenant exports.
        </p>
        <div className="flex flex-wrap gap-2">
          <Button disabled={!isOwner} variant="outline" render={<a href="/api/export/all-leads" />}>
            Export all leads
          </Button>
          <Button disabled={!isOwner} variant="outline" render={<a href="/api/export/all-calls" />}>
            Export all calls
          </Button>
          <Button disabled={!isOwner} variant="outline" render={<a href="/api/export/all-contacts" />}>
            Export all contacts
          </Button>
        </div>
      </Card>

      {isOwner ? (
        <Card className="grid gap-3 border-danger-border p-4">
          <div>
            <h2 className="text-base font-semibold text-danger-fg">Danger zone</h2>
            <p className="text-sm text-fg-secondary">
              High-risk tenant actions require confirmation.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Dialog open={dangerOpen} onOpenChange={setDangerOpen}>
              <DialogTrigger render={<Button variant="destructive" className="w-fit" />}>
                Cancel all running campaigns
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Cancel all running campaigns?</DialogTitle>
                  <DialogDescription>
                    This sets all running campaigns to cancelled and marks all in-progress
                    tasks as cancelled. This cannot be undone from this screen.
                  </DialogDescription>
                </DialogHeader>
                <DialogFooter showCloseButton>
                  <Button
                    variant="destructive"
                    disabled={pending}
                    onClick={() =>
                      run(async () => {
                        const result = await cancelAllRunningCampaigns();
                        if (result.ok) {
                          setDangerOpen(false);
                        }
                        return result;
                      })
                    }
                  >
                    Confirm cancellation
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
            <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
              <DialogTrigger render={<Button variant="outline" className="w-fit" />}>
                Delete tenant data
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Delete this agency workspace permanently?</DialogTitle>
                  <DialogDescription>
                    Delete this lead and tenant data permanently? This cannot be undone. Export data,
                    complete compliance review, then contact support for supervised deletion.
                  </DialogDescription>
                </DialogHeader>
                <DialogFooter showCloseButton>
                  <Button variant="destructive" disabled>
                    Requires support approval
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </Card>
      ) : null}
    </div>
  );
}
