"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ImportTemplateDialog } from "@/app/dashboard/agents/import-dialog";
import type {
  AgentTemplateRow,
  RetellVoiceSummary,
} from "@/app/dashboard/agents/types";
import {
  addSingleCallTask,
  createCampaign,
  placeSelfTestCall,
  previewAgentPrompt,
  retryCallTaskNow,
  skipCallTask,
  updateCampaignConfig,
  updateCampaignStatus,
  type CampaignActionResult,
} from "@/app/dashboard/campaigns/actions";
import { Button } from "@/components/ui/button";
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
import { Textarea } from "@/components/ui/textarea";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { getRetellPhoneNumberAgentIds } from "@/lib/retell/connection-state";

type AgentOption = {
  agent_id: string;
  agent_name?: string | null;
};

type PhoneNumberOption = {
  phone_number: string;
  nickname?: string;
  agent_id?: string;
  inbound_agent_id?: string;
  outbound_agent_id?: string;
  agent_ids?: string[];
  inbound_agent_ids?: string[];
  outbound_agent_ids?: string[];
};

export type TemplateAgentOption = {
  template_id: string;
  template_name: string;
  template_slug: string;
  retell_agent_id: string;
  required_variables: string[];
  default_variables: Record<string, unknown>;
  import_variables: Record<string, string>;
};

const purposes = [
  "reengagement",
  "followup",
  "referral_followup",
  "caregiver_recruitment",
  "eligibility_check",
  "general_outreach",
  "test",
] as const;

function SelectField({
  name,
  label,
  children,
  required = true,
  defaultValue,
  disabled = false,
}: {
  name: string;
  label: string;
  children: React.ReactNode;
  required?: boolean;
  defaultValue?: string;
  disabled?: boolean;
}) {
  return (
    <label className="grid gap-1">
      <Label>{label}</Label>
      <select
        name={name}
        defaultValue={defaultValue}
        required={required}
        disabled={disabled}
        className="h-8 rounded-lg border bg-background px-2 text-sm"
      >
        {children}
      </select>
    </label>
  );
}

function runAction(
  startTransition: React.TransitionStartFunction,
  action: () => Promise<CampaignActionResult>,
  onSuccess?: () => void
) {
  startTransition(async () => {
    const result = await action();
    if (result.ok) {
      toast.success(result.message);
      onSuccess?.();
    } else {
      toast.error(result.message);
    }
  });
}

export function NewCampaignDialog({
  agents,
  phoneNumbers,
  templateAgents,
  importableTemplates,
  voices,
  tenantName,
  webhookBaseUrl,
}: {
  agents: AgentOption[];
  phoneNumbers: PhoneNumberOption[];
  templateAgents: TemplateAgentOption[];
  importableTemplates: AgentTemplateRow[];
  voices: RetellVoiceSummary[];
  tenantName: string;
  webhookBaseUrl: string;
}) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const templateAgentIds = useMemo(
    () => new Set(templateAgents.map((option) => option.retell_agent_id)),
    [templateAgents]
  );
  const otherAgents = useMemo(
    () => agents.filter((agent) => !templateAgentIds.has(agent.agent_id)),
    [agents, templateAgentIds]
  );
  const firstAgent =
    templateAgents[0]?.retell_agent_id ?? otherAgents[0]?.agent_id ?? agents[0]?.agent_id ?? "";
  const [selectedAgentId, setSelectedAgentId] = useState(firstAgent);
  const selectedTemplateAgent = templateAgents.find(
    (option) => option.retell_agent_id === selectedAgentId
  );
  const linkedPhoneNumbers = phoneNumbers.filter(
    (phoneNumber) => getRetellPhoneNumberAgentIds(phoneNumber).includes(selectedAgentId)
  );
  const [selectedFromPhone, setSelectedFromPhone] = useState(
    linkedPhoneNumbers[0]?.phone_number ?? ""
  );
  const [scriptVariables, setScriptVariables] = useState<Record<string, string>>(
    selectedTemplateAgent
      ? Object.fromEntries(
          Object.entries({
            ...selectedTemplateAgent.default_variables,
            ...selectedTemplateAgent.import_variables,
          }).map(([key, value]) => [key, String(value ?? "")])
        )
      : {}
  );
  const [templatePickerOpen, setTemplatePickerOpen] = useState(false);
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [importTemplate, setImportTemplate] = useState<AgentTemplateRow | null>(
    importableTemplates[0] ?? null
  );

  function selectAgent(agentId: string) {
    if (agentId === "__import_template") {
      setImportTemplate(importableTemplates[0] ?? null);
      setTemplatePickerOpen(true);
      return;
    }

    setSelectedAgentId(agentId);
    const nextTemplateAgent = templateAgents.find(
      (option) => option.retell_agent_id === agentId
    );
    const nextPhone = phoneNumbers.find((phoneNumber) =>
      getRetellPhoneNumberAgentIds(phoneNumber).includes(agentId)
    );
    setSelectedFromPhone(nextPhone?.phone_number ?? "");
    setScriptVariables(
      nextTemplateAgent
        ? Object.fromEntries(
            Object.entries({
              ...nextTemplateAgent.default_variables,
              ...nextTemplateAgent.import_variables,
            }).map(([key, value]) => [key, String(value ?? "")])
          )
        : {}
    );
  }

  function updateScriptVariable(variable: string, value: string) {
    setScriptVariables((current) => ({
      ...current,
      [variable]: value,
    }));
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button />}>New campaign</DialogTrigger>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>New campaign</DialogTitle>
          <DialogDescription>
            Save an outbound campaign as a draft before uploading or adding call tasks.
          </DialogDescription>
        </DialogHeader>
        <form
          className="grid gap-3"
          action={(formData) =>
            runAction(
              startTransition,
              () =>
                createCampaign({
                  name: formData.get("name"),
                  purpose: formData.get("purpose"),
                  description: formData.get("description"),
                  agent_id: selectedAgentId,
                  from_phone: selectedFromPhone,
                  script_variables: JSON.stringify(scriptVariables),
                  max_concurrent: formData.get("max_concurrent"),
                  max_attempts_per_task: formData.get("max_attempts_per_task"),
                  retry_delay_minutes: formData.get("retry_delay_minutes"),
                  call_window_start: formData.get("call_window_start"),
                  call_window_end: formData.get("call_window_end"),
                  call_window_timezone: formData.get("call_window_timezone"),
                }),
              () => setOpen(false)
            )
          }
        >
          <div className="grid gap-3 md:grid-cols-2">
            <label className="grid gap-1">
              <Label>Name</Label>
              <Input name="name" required placeholder="Reengagement campaign" />
            </label>
            <SelectField name="purpose" label="Purpose" defaultValue="test">
              {purposes.map((purpose) => (
                <option key={purpose} value={purpose}>
                  {purpose.replaceAll("_", " ")}
                </option>
              ))}
            </SelectField>
          </div>
          <label className="grid gap-1">
            <Label>Description</Label>
            <Textarea name="description" placeholder="Who this campaign should call and why." />
          </label>
          <div className="grid gap-3 md:grid-cols-2">
            <label className="grid gap-1">
              <Label>Agent</Label>
              <select
                value={selectedAgentId}
                required
                className="h-8 rounded-lg border bg-background px-2 text-sm"
                onChange={(event) => selectAgent(event.target.value)}
              >
                <option value="" disabled>
                  Select an agent
                </option>
                {templateAgents.length ? (
                  <optgroup label="Your imported templates">
                    {templateAgents.map((option) => (
                      <option
                        key={`${option.template_id}-${option.retell_agent_id}`}
                        value={option.retell_agent_id}
                      >
                        {option.template_name} - {option.retell_agent_id}
                      </option>
                    ))}
                  </optgroup>
                ) : null}
                {otherAgents.length ? (
                  <optgroup label="Other Retell agents">
                    {otherAgents.map((agent) => (
                      <option key={agent.agent_id} value={agent.agent_id}>
                        {agent.agent_name || agent.agent_id}
                      </option>
                    ))}
                  </optgroup>
                ) : null}
                <option value="__import_template">+ Import a template</option>
              </select>
            </label>
            <label className="grid gap-1">
              <Label>From number</Label>
              <select
                value={selectedFromPhone}
                required
                className="h-8 rounded-lg border bg-background px-2 text-sm"
                onChange={(event) => setSelectedFromPhone(event.target.value)}
              >
                <option value="" disabled>
                  {selectedAgentId
                    ? "Select a number linked to this agent"
                    : "Select an agent first"}
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
          {selectedTemplateAgent ? (
            <div className="grid gap-3 rounded-lg border bg-muted/20 p-3">
              <div>
                <p className="text-sm font-medium">Template variables</p>
                <p className="text-xs text-muted-foreground">
                  Import-time values are prefilled. Override them for this campaign as needed.
                </p>
              </div>
              {selectedTemplateAgent.required_variables.length ? (
                selectedTemplateAgent.required_variables.map((variable) => (
                  <label key={variable} className="grid gap-1">
                    <Label>{variable}</Label>
                    <Input
                      value={scriptVariables[variable] ?? ""}
                      onChange={(event) => updateScriptVariable(variable, event.target.value)}
                    />
                  </label>
                ))
              ) : (
                <p className="text-sm text-muted-foreground">
                  This template has no required variables.
                </p>
              )}
            </div>
          ) : null}
          <div className="grid gap-3 md:grid-cols-3">
            <label className="grid gap-1">
              <Label>Max concurrent</Label>
              <Input name="max_concurrent" type="number" min={1} defaultValue={1} />
            </label>
            <label className="grid gap-1">
              <Label>Max attempts</Label>
              <Input name="max_attempts_per_task" type="number" min={1} defaultValue={3} />
            </label>
            <label className="grid gap-1">
              <Label>Retry delay minutes</Label>
              <Input name="retry_delay_minutes" type="number" min={1} defaultValue={60} />
            </label>
          </div>
          <div className="grid gap-3 md:grid-cols-3">
            <label className="grid gap-1">
              <Label>Window start</Label>
              <Input name="call_window_start" type="time" defaultValue="09:00" />
            </label>
            <label className="grid gap-1">
              <Label>Window end</Label>
              <Input name="call_window_end" type="time" defaultValue="20:00" />
            </label>
            <label className="grid gap-1">
              <Label>Timezone</Label>
              <Input name="call_window_timezone" defaultValue="America/Detroit" />
            </label>
          </div>
          <DialogFooter>
            <Button type="submit" disabled={pending || !selectedAgentId || !selectedFromPhone}>
              Save draft
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
      <Dialog open={templatePickerOpen} onOpenChange={setTemplatePickerOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Import a template</DialogTitle>
            <DialogDescription>
              Choose a template to import to Retell, then use the new agent for this campaign.
            </DialogDescription>
          </DialogHeader>
          <label className="grid gap-1">
            <Label>Template</Label>
            <select
              value={importTemplate?.id ?? ""}
              className="h-8 rounded-lg border bg-background px-2 text-sm"
              onChange={(event) => {
                setImportTemplate(
                  importableTemplates.find((template) => template.id === event.target.value) ??
                    null
                );
              }}
            >
              {importableTemplates.map((template) => (
                <option key={template.id} value={template.id}>
                  {template.name}
                </option>
              ))}
            </select>
          </label>
          <DialogFooter>
            <Button
              disabled={!importTemplate}
              onClick={() => {
                setTemplatePickerOpen(false);
                setImportDialogOpen(true);
              }}
            >
              Continue
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <ImportTemplateDialog
        open={importDialogOpen}
        onOpenChange={setImportDialogOpen}
        template={importTemplate}
        tenantName={tenantName}
        webhookBaseUrl={webhookBaseUrl}
        voices={voices}
        onImported={(result, template) => {
          setSelectedAgentId(result.agent_id);
          setScriptVariables(result.variables ?? {});
          setSelectedFromPhone("");
          setImportDialogOpen(false);
          toast.info(
            `${template.name} imported. Link a phone number to ${result.agent_id}, then choose it here.`
          );
        }}
      />
    </Dialog>
  );
}

export function CampaignStatusActions({
  campaignId,
  status,
  retellConnected = true,
}: {
  campaignId: string;
  status: string;
  retellConnected?: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const nextStatus = status === "running" ? "paused" : "running";
  const disabled = pending || !retellConnected;
  const tooltip = !retellConnected ? "Fix Retell connection first." : null;

  function wrapAction(content: React.ReactNode) {
    if (!tooltip) {
      return content;
    }

    return (
      <Tooltip>
        <TooltipTrigger render={<span className="inline-flex" />}>{content}</TooltipTrigger>
        <TooltipContent>{tooltip}</TooltipContent>
      </Tooltip>
    );
  }

  return (
    <div className="flex flex-wrap gap-2">
      {!["completed", "cancelled"].includes(status) ? (
        wrapAction(
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={disabled}
            onClick={() =>
              runAction(startTransition, () =>
                updateCampaignStatus({ campaign_id: campaignId, status: nextStatus })
              )
            }
          >
            {status === "running" ? "Pause" : "Start"}
          </Button>
        )
      ) : null}
      {status !== "completed" ? (
        wrapAction(
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={disabled}
            onClick={() =>
              runAction(startTransition, () =>
                updateCampaignStatus({ campaign_id: campaignId, status: "completed" })
              )
            }
          >
            Complete
          </Button>
        )
      ) : null}
      {status !== "cancelled" ? (
        wrapAction(
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={disabled}
            onClick={() =>
              runAction(startTransition, () =>
                updateCampaignStatus({ campaign_id: campaignId, status: "cancelled" })
              )
            }
          >
            Cancel
          </Button>
        )
      ) : null}
    </div>
  );
}

export function SelfTestCard({
  agents,
  phoneNumbers,
}: {
  agents: AgentOption[];
  phoneNumbers: PhoneNumberOption[];
}) {
  const [pending, startTransition] = useTransition();
  const firstAgent = agents[0]?.agent_id ?? "";
  const firstPhoneNumber = phoneNumbers[0]?.phone_number ?? "";

  return (
    <form
      className="grid gap-3 md:grid-cols-[1fr_1fr_1fr_auto]"
      action={(formData) =>
        runAction(startTransition, () =>
          placeSelfTestCall({
            phone: formData.get("phone"),
            agent_id: formData.get("agent_id"),
            from_phone: formData.get("from_phone"),
          })
        )
      }
    >
      <label className="grid gap-1">
        <Label>Your phone</Label>
        <Input name="phone" placeholder="+13135550101" required />
      </label>
      <SelectField name="agent_id" label="Agent" defaultValue={firstAgent}>
        <option value="" disabled>
          Select an agent
        </option>
        {agents.map((agent) => (
          <option key={agent.agent_id} value={agent.agent_id}>
            {agent.agent_name || agent.agent_id}
          </option>
        ))}
      </SelectField>
      <SelectField name="from_phone" label="From number" defaultValue={firstPhoneNumber}>
        <option value="" disabled>
          Select a number
        </option>
        {phoneNumbers.map((phoneNumber) => (
          <option key={phoneNumber.phone_number} value={phoneNumber.phone_number}>
            {phoneNumber.nickname
              ? `${phoneNumber.nickname} (${phoneNumber.phone_number})`
              : phoneNumber.phone_number}
          </option>
        ))}
      </SelectField>
      <Button
        type="submit"
        className="self-end"
        disabled={pending || !firstAgent || !firstPhoneNumber}
      >
        Place test call
      </Button>
    </form>
  );
}

export function CampaignHeaderActions({
  campaignId,
  status,
  canAdmin,
}: {
  campaignId: string;
  status: string;
  canAdmin: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [dispatching, setDispatching] = useState(false);
  const dispatchingRef = useRef(false);
  const actions =
    status === "draft"
      ? [{ label: "Mark ready", status: "ready" }]
      : status === "ready"
        ? [{ label: "Start", status: "running" }]
        : status === "running"
          ? [
              { label: "Pause", status: "paused" },
              { label: "Complete", status: "completed" },
            ]
          : status === "paused"
            ? [
                { label: "Resume", status: "running" },
                { label: "Cancel", status: "cancelled" },
              ]
            : status === "completed"
              ? [{ label: "Reopen", status: "paused" }]
            : [];

  const dispatchNow = useCallback(async (options: { silent?: boolean } = {}) => {
    if (dispatchingRef.current) {
      return;
    }

    dispatchingRef.current = true;
    setDispatching(true);
    try {
      const response = await fetch(`/api/campaigns/${campaignId}/dispatch-now`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ limit: 5 }),
      });

      if (!response.ok) {
        if (!options.silent) {
          toast.error("Unable to dispatch campaign.");
        }
        return;
      }

      const result = (await response.json()) as { launched: number; failed: number };
      if (!options.silent) {
        toast.success(`Dispatched ${result.launched} calls. Failed: ${result.failed}.`);
      }
      if (!options.silent || result.launched > 0 || result.failed > 0) {
        router.refresh();
      }
    } finally {
      dispatchingRef.current = false;
      setDispatching(false);
    }
  }, [campaignId, router]);

  useEffect(() => {
    if (status !== "running" || !canAdmin) {
      return;
    }

    const interval = window.setInterval(() => {
      void dispatchNow({ silent: true });
    }, 10_000);

    return () => window.clearInterval(interval);
  }, [canAdmin, dispatchNow, status]);

  return (
    <div className="flex flex-wrap gap-2">
      {actions.map((action) => (
        <Button
          key={action.status}
          type="button"
          variant={action.status === "cancelled" ? "destructive" : "outline"}
          disabled={pending || !canAdmin}
          onClick={() =>
            runAction(
              startTransition,
              () => updateCampaignStatus({ campaign_id: campaignId, status: action.status }),
              () => router.refresh()
            )
          }
        >
          {action.label}
        </Button>
      ))}
      {status === "running" ? (
        <Button
          type="button"
          disabled={dispatching || !canAdmin}
          onClick={() => void dispatchNow()}
        >
          Dispatch now
        </Button>
      ) : null}
    </div>
  );
}

export function TaskRowActions({
  campaignId,
  taskId,
  status,
  lastCallHref,
}: {
  campaignId: string;
  taskId: string;
  status: string;
  lastCallHref: string | null;
}) {
  const [pending, startTransition] = useTransition();

  return (
    <div className="flex flex-wrap gap-2">
      {["failed", "no_answer"].includes(status) ? (
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={pending}
          onClick={() =>
            runAction(startTransition, () =>
              retryCallTaskNow({ campaign_id: campaignId, task_id: taskId })
            )
          }
        >
          Retry now
        </Button>
      ) : null}
      {!["completed", "cancelled"].includes(status) ? (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          disabled={pending}
          onClick={() =>
            runAction(startTransition, () =>
              skipCallTask({ campaign_id: campaignId, task_id: taskId })
            )
          }
        >
          Skip
        </Button>
      ) : null}
      {lastCallHref ? (
        <Button type="button" variant="outline" size="sm" render={<a href={lastCallHref} />}>
          View last call
        </Button>
      ) : null}
    </div>
  );
}

export function AddSingleTaskDialog({ campaignId }: { campaignId: string }) {
  const [pending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant="accent" />}>Add single task</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add single task</DialogTitle>
          <DialogDescription>
            Add one phone number to this campaign. It starts queued and will call when the campaign runs.
          </DialogDescription>
        </DialogHeader>
        <form
          className="grid gap-3"
          action={(formData) =>
            runAction(
              startTransition,
              () =>
                addSingleCallTask({
                  campaign_id: campaignId,
                  phone: formData.get("phone"),
                  contact_name: formData.get("contact_name"),
                  merge_fields: formData.get("merge_fields"),
                }),
              () => setOpen(false)
            )
          }
        >
          <label className="grid gap-1">
            <Label>Phone</Label>
            <Input name="phone" placeholder="+13135550101" required />
          </label>
          <label className="grid gap-1">
            <Label>Name</Label>
            <Input name="contact_name" placeholder="Optional" />
          </label>
          <label className="grid gap-1">
            <Label>Merge fields JSON</Label>
            <Textarea name="merge_fields" defaultValue="{}" className="min-h-28 font-mono text-xs" />
          </label>
          <DialogFooter>
            <Button type="submit" disabled={pending}>
              {pending ? "Adding..." : "Add task"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function CsvUploadDialog() {
  return (
    <Dialog>
      <DialogTrigger render={<Button variant="outline" />}>Add tasks from CSV</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add tasks from CSV</DialogTitle>
          <DialogDescription>
            CSV parsing is available in the backend helper. Upload wiring will be connected in the
            campaign CSV upload step.
          </DialogDescription>
        </DialogHeader>
        <Input type="file" accept=".csv,text/csv" disabled />
        <DialogFooter showCloseButton />
      </DialogContent>
    </Dialog>
  );
}

export function CampaignConfigForm({
  campaign,
  agents,
  phoneNumbers,
}: {
  campaign: {
    id: string;
    name: string;
    purpose: string;
    description: string | null;
    agent_id: string;
    from_phone: string;
    max_concurrent: number;
    max_attempts_per_task: number;
    retry_delay_minutes: number;
    call_window_start: string | null;
    call_window_end: string | null;
    call_window_timezone: string | null;
    script_variables: Record<string, unknown> | null;
    status: string;
  };
  agents: AgentOption[];
  phoneNumbers: PhoneNumberOption[];
}) {
  const [pending, startTransition] = useTransition();
  const readOnly = !["draft", "ready", "paused"].includes(campaign.status);
  const [scriptText, setScriptText] = useState(
    JSON.stringify(campaign.script_variables ?? {}, null, 2)
  );

  return (
    <form
      className="grid gap-4"
      action={(formData) =>
        runAction(startTransition, () =>
          updateCampaignConfig({
            campaign_id: campaign.id,
            name: formData.get("name"),
            purpose: formData.get("purpose"),
            description: formData.get("description"),
            agent_id: formData.get("agent_id"),
            from_phone: formData.get("from_phone"),
            max_concurrent: formData.get("max_concurrent"),
            max_attempts_per_task: formData.get("max_attempts_per_task"),
            retry_delay_minutes: formData.get("retry_delay_minutes"),
            call_window_start: formData.get("call_window_start"),
            call_window_end: formData.get("call_window_end"),
            call_window_timezone: formData.get("call_window_timezone"),
            script_variables: formData.get("script_variables"),
          })
        )
      }
    >
      {readOnly ? (
        <div className="rounded-lg border border-warning-border bg-warning-bg p-3 text-sm text-warning-fg">
          This campaign is {campaign.status.replaceAll("_", " ")}. Pause or duplicate it before editing configuration.
        </div>
      ) : null}
      <div className="grid gap-3 md:grid-cols-2">
        <label className="grid gap-1">
          <Label>Name</Label>
          <Input name="name" defaultValue={campaign.name} disabled={readOnly} required />
        </label>
        <SelectField
          name="purpose"
          label="Purpose"
          defaultValue={campaign.purpose}
          disabled={readOnly}
        >
          {purposes.map((purpose) => (
            <option key={purpose} value={purpose}>
              {purpose.replaceAll("_", " ")}
            </option>
          ))}
        </SelectField>
      </div>
      <label className="grid gap-1">
        <Label>Description</Label>
        <Textarea
          name="description"
          defaultValue={campaign.description ?? ""}
          disabled={readOnly}
        />
      </label>
      <div className="grid gap-3 md:grid-cols-2">
        <SelectField
          name="agent_id"
          label="Agent"
          defaultValue={campaign.agent_id}
          disabled={readOnly}
        >
          {agents.map((agent) => (
            <option key={agent.agent_id} value={agent.agent_id}>
              {agent.agent_name || agent.agent_id}
            </option>
          ))}
        </SelectField>
        <SelectField
          name="from_phone"
          label="From number"
          defaultValue={campaign.from_phone}
          disabled={readOnly}
        >
          {phoneNumbers.map((phoneNumber) => (
            <option key={phoneNumber.phone_number} value={phoneNumber.phone_number}>
              {phoneNumber.nickname
                ? `${phoneNumber.nickname} (${phoneNumber.phone_number})`
                : phoneNumber.phone_number}
            </option>
          ))}
        </SelectField>
      </div>
      <div className="grid gap-3 md:grid-cols-3">
        <label className="grid gap-1">
          <Label>Max concurrent</Label>
          <Input
            name="max_concurrent"
            type="number"
            min={1}
            defaultValue={campaign.max_concurrent}
            disabled={readOnly}
          />
        </label>
        <label className="grid gap-1">
          <Label>Max attempts</Label>
          <Input
            name="max_attempts_per_task"
            type="number"
            min={1}
            defaultValue={campaign.max_attempts_per_task}
            disabled={readOnly}
          />
        </label>
        <label className="grid gap-1">
          <Label>Retry delay</Label>
          <Input
            name="retry_delay_minutes"
            type="number"
            min={1}
            defaultValue={campaign.retry_delay_minutes}
            disabled={readOnly}
          />
        </label>
      </div>
      <div className="grid gap-3 md:grid-cols-3">
        <label className="grid gap-1">
          <Label>Window start</Label>
          <Input
            name="call_window_start"
            type="time"
            defaultValue={(campaign.call_window_start ?? "09:00").slice(0, 5)}
            disabled={readOnly}
          />
        </label>
        <label className="grid gap-1">
          <Label>Window end</Label>
          <Input
            name="call_window_end"
            type="time"
            defaultValue={(campaign.call_window_end ?? "20:00").slice(0, 5)}
            disabled={readOnly}
          />
        </label>
        <label className="grid gap-1">
          <Label>Timezone</Label>
          <Input
            name="call_window_timezone"
            defaultValue={campaign.call_window_timezone ?? "America/Detroit"}
            disabled={readOnly}
          />
        </label>
      </div>
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <label className="grid gap-1">
          <Label>Script variables</Label>
          <Textarea
            name="script_variables"
            value={scriptText}
            onChange={(event) => setScriptText(event.target.value)}
            disabled={readOnly}
            className="min-h-56 font-mono text-xs"
          />
        </label>
        <div className="rounded-xl border border-border-default bg-bg-surface-sunken p-4">
          <p className="text-sm font-semibold">Prompt variable preview</p>
          <p className="mt-1 text-xs text-fg-tertiary">
            Updates as campaign variables change.
          </p>
          <pre className="mt-3 max-h-48 overflow-auto rounded-lg bg-bg-surface p-3 text-xs whitespace-pre-wrap">
            {scriptText}
          </pre>
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        <PromptPreviewButton
          agentId={campaign.agent_id}
          scriptVariables={scriptText}
        />
        <Button type="submit" disabled={pending || readOnly}>
          Save
        </Button>
      </div>
    </form>
  );
}

export function PromptPreviewButton({
  agentId,
  scriptVariables,
}: {
  agentId: string;
  scriptVariables: string;
}) {
  const [pending, startTransition] = useTransition();
  const [prompt, setPrompt] = useState<string | null>(null);

  return (
    <Dialog>
      <DialogTrigger
        render={
          <Button
            type="button"
            variant="outline"
            disabled={pending}
            onClick={() =>
              runAction(startTransition, async () => {
                const result = await previewAgentPrompt({
                  agent_id: agentId,
                  script_variables: scriptVariables,
                  sample_merge_fields: "{}",
                });
                if (result.ok && result.prompt) {
                  setPrompt(result.prompt);
                }
                return result;
              })
            }
          />
        }
      >
        Preview prompt
      </DialogTrigger>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Prompt preview</DialogTitle>
          <DialogDescription>
            Current Retell prompt rendered with sample campaign variables.
          </DialogDescription>
        </DialogHeader>
        <pre className="max-h-[60vh] overflow-auto rounded-lg bg-muted p-3 text-xs whitespace-pre-wrap">
          {prompt ?? "Click Preview prompt to load the current Retell prompt."}
        </pre>
      </DialogContent>
    </Dialog>
  );
}
