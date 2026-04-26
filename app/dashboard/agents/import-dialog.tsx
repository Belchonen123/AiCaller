"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { toast } from "sonner";
import { importTemplateToRetell } from "@/app/dashboard/agents/actions";
import type {
  AgentTemplateRow,
  ImportTemplateResult,
  RetellVoiceSummary,
} from "@/app/dashboard/agents/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

type ImportDialogProps = {
  template: AgentTemplateRow | null;
  tenantName: string;
  webhookBaseUrl: string;
  voices: RetellVoiceSummary[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImported?: (result: ImportTemplateResult, template: AgentTemplateRow) => void;
};

function getPrompt(template: AgentTemplateRow | null) {
  const payload = template?.retell_payload;
  if (!payload || typeof payload !== "object" || !("retell_llm" in payload)) {
    return "";
  }

  const retellLlm = (payload as { retell_llm?: unknown }).retell_llm;
  if (!retellLlm || typeof retellLlm !== "object" || !("general_prompt" in retellLlm)) {
    return "";
  }

  const prompt = (retellLlm as { general_prompt?: unknown }).general_prompt;
  return typeof prompt === "string" ? prompt : "";
}

function defaultValue(template: AgentTemplateRow, variable: string) {
  const value = template.default_variables?.[variable];
  return typeof value === "string" ? value : "";
}

function renderPromptPreview(prompt: string, values: Record<string, string>) {
  const parts: Array<{ text: string; highlighted: boolean }> = [];
  let cursor = 0;

  for (const match of prompt.matchAll(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g)) {
    const index = match.index ?? 0;
    const variable = match[1];
    if (index > cursor) {
      parts.push({ text: prompt.slice(cursor, index), highlighted: false });
    }
    parts.push({ text: values[variable] || match[0], highlighted: true });
    cursor = index + match[0].length;
  }

  if (cursor < prompt.length) {
    parts.push({ text: prompt.slice(cursor), highlighted: false });
  }

  return parts;
}

function isLocalhostUrl(value: string) {
  try {
    const url = new URL(value);
    return ["localhost", "127.0.0.1"].includes(url.hostname);
  } catch {
    return false;
  }
}

function isHttpsUrl(value: string) {
  try {
    return new URL(value).protocol === "https:";
  } catch {
    return false;
  }
}

export function ImportTemplateDialog({
  template,
  tenantName,
  webhookBaseUrl,
  voices,
  open,
  onOpenChange,
  onImported,
}: ImportDialogProps) {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [pending, startTransition] = useTransition();
  const [agentName, setAgentName] = useState("");
  const [voiceId, setVoiceId] = useState("");
  const [language, setLanguage] = useState("en-US");
  const [variables, setVariables] = useState<Record<string, string>>({});
  const [resultAgentId, setResultAgentId] = useState<string | null>(null);
  const requiredVariables = useMemo(
    () => template?.required_variables ?? [],
    [template?.required_variables]
  );
  const prompt = getPrompt(template);
  const effectiveAgentName =
    agentName || (template ? `${template.name} - ${tenantName}` : "");
  const effectiveVoiceId = voiceId || template?.default_voice || "";
  const effectiveVariables = useMemo(() => {
    if (!template) {
      return {};
    }

    return Object.fromEntries(
      requiredVariables.map((variable) => [
        variable,
        variables[variable] ?? defaultValue(template, variable),
      ])
    );
  }, [requiredVariables, template, variables]);
  const allRequiredFilled = requiredVariables.every((variable) => {
    return (effectiveVariables[variable] ?? "").trim();
  });
  const webhookWarning = !isHttpsUrl(webhookBaseUrl)
    ? "Webhook URL must use https:// before importing to Retell."
    : isLocalhostUrl(webhookBaseUrl)
      ? "Localhost webhooks cannot receive Retell calls outside your machine."
      : null;
  const promptPreview = useMemo(
    () =>
      renderPromptPreview(prompt, {
        ...effectiveVariables,
        webhook_base_url: webhookBaseUrl,
      }),
    [effectiveVariables, prompt, webhookBaseUrl]
  );

  function reset(nextOpen: boolean) {
    if (!nextOpen) {
      setStep(1);
      setAgentName("");
      setVoiceId("");
      setLanguage("en-US");
      setVariables({});
      setResultAgentId(null);
    }
    onOpenChange(nextOpen);
  }

  function updateVariable(variable: string, value: string) {
    setVariables((current) => ({
      ...current,
      [variable]: value,
    }));
  }

  function submit() {
    if (!template) {
      return;
    }

    if (!allRequiredFilled) {
      toast.error("Fill in every required variable before importing.");
      setStep(2);
      return;
    }

    if (!isHttpsUrl(webhookBaseUrl)) {
      toast.error("Webhook URL must use https:// before importing to Retell.");
      return;
    }

    startTransition(async () => {
      try {
        const result = await importTemplateToRetell({
          template_id: template.id,
          overrides: {
            agent_name: effectiveAgentName,
            voice_id: effectiveVoiceId,
            language,
            webhook_base_url: webhookBaseUrl,
            variables: effectiveVariables,
          },
        });
        setResultAgentId(result.agent_id);
        onImported?.(result, template);
        toast.success(
          `Agent imported. Retell agent ID: ${result.agent_id} — you can now assign a phone number and start using it.`
        );
        router.refresh();
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Agent import failed.");
      }
    });
  }

  if (!template) {
    return null;
  }

  return (
    <Dialog open={open} onOpenChange={reset}>
      <DialogContent className="sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>Import to my agency</DialogTitle>
          <DialogDescription>{template.name}</DialogDescription>
        </DialogHeader>

        <div className="flex flex-wrap gap-2">
          {[1, 2, 3].map((item) => (
            <Badge key={item} variant={step === item ? "default" : "outline"}>
              Step {item}
            </Badge>
          ))}
        </div>

        {step === 1 ? (
          <div className="grid gap-4">
            <div className="grid gap-2">
              <Label htmlFor="agentName">Agent name</Label>
              <Input
                id="agentName"
                value={effectiveAgentName}
                onChange={(event) => setAgentName(event.target.value)}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="voiceId">Voice ID</Label>
              <select
                id="voiceId"
                className="h-9 rounded-lg border bg-background px-2 text-sm"
                value={effectiveVoiceId}
                onChange={(event) => setVoiceId(event.target.value)}
              >
                {template.default_voice ? (
                  <option value={template.default_voice}>{template.default_voice}</option>
                ) : null}
                {voices.map((voice) => (
                  <option key={voice.voice_id} value={voice.voice_id}>
                    {voice.voice_name ?? voice.voice_id}
                  </option>
                ))}
              </select>
              {voices.find((voice) => voice.voice_id === effectiveVoiceId)
                ?.preview_audio_url ? (
                <audio
                  controls
                  src={
                    voices.find((voice) => voice.voice_id === effectiveVoiceId)
                      ?.preview_audio_url ?? undefined
                  }
                />
              ) : null}
            </div>
            <div className="grid gap-2">
              <Label htmlFor="language">Language</Label>
              <Input
                id="language"
                value={language}
                onChange={(event) => setLanguage(event.target.value)}
              />
            </div>
          </div>
        ) : null}

        {step === 2 ? (
          <div className="grid gap-4">
            {requiredVariables.map((variable) => (
              <div key={variable} className="grid gap-2">
                <div className="flex items-center gap-2">
                  <Label htmlFor={`variable-${variable}`}>{variable}</Label>
                  <Tooltip>
                    <TooltipTrigger>
                      <Badge variant="outline">?</Badge>
                    </TooltipTrigger>
                    <TooltipContent>
                      Used wherever <code>{`{{${variable}}}`}</code> appears in the
                      template prompt or Retell payload.
                    </TooltipContent>
                  </Tooltip>
                </div>
                <Input
                  id={`variable-${variable}`}
                  value={effectiveVariables[variable] ?? ""}
                  onChange={(event) => updateVariable(variable, event.target.value)}
                />
              </div>
            ))}
          </div>
        ) : null}

        {step === 3 ? (
          <div className="grid max-h-[60vh] gap-4 overflow-y-auto pr-1">
            <div>
              <p className="text-xs font-medium text-muted-foreground">Webhook URL</p>
              <p className="break-all font-mono text-xs">
                {webhookBaseUrl}/api/retell/webhook
              </p>
              {webhookWarning ? (
                <p className="mt-1 text-sm text-destructive">{webhookWarning}</p>
              ) : null}
            </div>
            <div>
              <p className="text-xs font-medium text-muted-foreground">
                Rendered prompt preview
              </p>
              <div className="mt-1 whitespace-pre-wrap rounded-lg bg-muted p-3 text-xs leading-relaxed">
                {promptPreview.map((part, index) => (
                  <span
                    key={`${part.text}-${index}`}
                    className={part.highlighted ? "rounded bg-amber-200 px-1 text-black" : ""}
                  >
                    {part.text}
                  </span>
                ))}
              </div>
            </div>
          </div>
        ) : null}

        {resultAgentId ? (
          <div className="rounded-lg border bg-muted/50 p-3 text-sm">
            Imported Retell agent ID:{" "}
            <Link
              href={`https://dashboard.retellai.com/agents/${resultAgentId}`}
              target="_blank"
              className="font-mono underline"
            >
              {resultAgentId}
            </Link>
          </div>
        ) : null}

        <DialogFooter>
          <Button
            variant="outline"
            disabled={step === 1 || pending}
            onClick={() => setStep(step - 1)}
          >
            Back
          </Button>
          {step < 3 ? (
            <Button onClick={() => setStep(step + 1)}>Next</Button>
          ) : (
            <Button
              disabled={pending || !allRequiredFilled || !isHttpsUrl(webhookBaseUrl)}
              onClick={submit}
            >
              {pending ? "Importing..." : "Import to Retell"}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
