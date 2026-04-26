"use client";

import { useMemo, useState, useTransition } from "react";
import { toast } from "sonner";
import {
  saveUploadedTemplate,
  validateUploadedTemplate,
} from "@/app/dashboard/agents/actions";
import type { AgentTemplateRow } from "@/app/dashboard/agents/types";
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
import { Textarea } from "@/components/ui/textarea";

type UploadTemplateDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImportSavedTemplate: (template: AgentTemplateRow) => void;
};

type VariableState = {
  name: string;
  required: boolean;
  defaultValue: string;
};

const MAX_FILE_BYTES = 500 * 1024;
const purposes = [
  "client_intake",
  "caregiver_recruitment",
  "reengagement",
  "eligibility_followup",
  "appointment_reminder",
  "satisfaction_survey",
  "general",
  "test",
] as const;

const exampleTemplate = {
  agent_name: "Example Michigan Home Help Intake",
  voice_id: "11labs-Rachel",
  language: "en-US",
  response_engine: {
    type: "retell-llm",
  },
  webhook_url: "{{webhook_base_url}}/api/retell/webhook",
  interruption_sensitivity: 0.4,
  enable_backchannel: true,
  voice_speed: 0.95,
  end_call_after_silence_ms: 12000,
  max_call_duration_ms: 900000,
  retell_llm: {
    begin_message:
      "Hi, thanks for calling {{agency_name}}. How can I help you today?",
    model: "claude-sonnet-4-6",
    general_prompt:
      "You are the inbound phone assistant for {{agency_name}}, a Michigan Medicaid Home Help agency. Gather basic intake details, never promise eligibility, and tell callers the agency will call back {{agency_callback_hours}}.",
    general_tools: [
      {
        type: "function",
        name: "lookup_caller",
        url: "{{webhook_base_url}}/api/retell/tools/lookup-caller",
        method: "POST",
        args_schema: {
          type: "object",
          properties: {
            phone_number: { type: "string" },
          },
          required: ["phone_number"],
        },
      },
    ],
  },
};

function parseTags(value: string) {
  return value
    .split(",")
    .map((tag) => tag.trim())
    .filter(Boolean);
}

function downloadExample() {
  const blob = new Blob([JSON.stringify(exampleTemplate, null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "example-inbound-intake.json";
  link.click();
  URL.revokeObjectURL(url);
}

export function UploadTemplateDialog({
  open,
  onOpenChange,
  onImportSavedTemplate,
}: UploadTemplateDialogProps) {
  const [step, setStep] = useState(1);
  const [jsonText, setJsonText] = useState("");
  const [issues, setIssues] = useState<string[]>([]);
  const [payload, setPayload] = useState<unknown>(null);
  const [variables, setVariables] = useState<VariableState[]>([]);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState<"inbound" | "outbound" | "test" | "specialty">(
    "inbound"
  );
  const [purpose, setPurpose] = useState<(typeof purposes)[number]>("client_intake");
  const [tags, setTags] = useState("");
  const [savedTemplate, setSavedTemplate] = useState<AgentTemplateRow | null>(null);
  const [pending, startTransition] = useTransition();
  const requiredVariables = useMemo(
    () => variables.filter((variable) => variable.required).map((variable) => variable.name),
    [variables]
  );
  const defaultVariables = useMemo(
    () =>
      Object.fromEntries(
        variables
          .filter((variable) => variable.defaultValue.trim())
          .map((variable) => [variable.name, variable.defaultValue.trim()])
      ),
    [variables]
  );

  function reset(nextOpen: boolean) {
    if (!nextOpen) {
      setStep(1);
      setJsonText("");
      setIssues([]);
      setPayload(null);
      setVariables([]);
      setName("");
      setDescription("");
      setCategory("inbound");
      setPurpose("client_intake");
      setTags("");
      setSavedTemplate(null);
    }
    onOpenChange(nextOpen);
  }

  async function readFile(file: File) {
    if (!file.name.endsWith(".json")) {
      setIssues(["Only .json files are supported."]);
      return;
    }

    if (file.size > MAX_FILE_BYTES) {
      setIssues(["JSON file must be 500 KB or smaller."]);
      return;
    }

    setJsonText(await file.text());
    setIssues([]);
  }

  function continueToPreview() {
    startTransition(async () => {
      try {
        JSON.parse(jsonText);
      } catch {
        setIssues(["Malformed JSON. Check the file and try again."]);
        return;
      }

      const result = await validateUploadedTemplate({ json_text: jsonText });
      setIssues(result.issues);
      setPayload(result.payload);
      setVariables(
        result.detected_variables
          .filter((variable) => variable !== "webhook_base_url")
          .map((variable) => ({
            name: variable,
            required: true,
            defaultValue: "",
          }))
      );

      if (result.valid && result.payload) {
        setName(result.payload.agent_name ?? "");
        setCategory("inbound");
        setTags(result.detected_variables.includes("webhook_base_url") ? "uploaded,retell" : "uploaded");
        setStep(2);
      }
    });
  }

  function updateVariable(variable: string, patch: Partial<VariableState>) {
    setVariables((current) =>
      current.map((item) => (item.name === variable ? { ...item, ...patch } : item))
    );
  }

  function saveTemplate() {
    if (!payload) {
      toast.error("Validate a Retell payload before saving.");
      return;
    }

    startTransition(async () => {
      try {
        const result = await saveUploadedTemplate({
          metadata: {
            name,
            description,
            category,
            purpose,
            tags: parseTags(tags),
          },
          payload,
          required_variables: requiredVariables,
          default_variables: defaultVariables,
        });
        setSavedTemplate(result.template);
        setStep(3);
        toast.success("Template saved. You can now import it to Retell.");
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Unable to save template.");
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={reset}>
      <DialogContent className="sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>Import from JSON file</DialogTitle>
          <DialogDescription>
            Upload a Retell-compatible JSON template or paste the JSON directly.
          </DialogDescription>
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
            <div className="flex justify-end">
              <Button variant="outline" type="button" onClick={downloadExample}>
                Download example JSON
              </Button>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="templateFile">JSON file</Label>
              <Input
                id="templateFile"
                type="file"
                accept="application/json,.json"
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (file) void readFile(file);
                }}
              />
              <p className="text-xs text-muted-foreground">Maximum file size: 500 KB.</p>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="templateJson">Paste JSON</Label>
              <Textarea
                id="templateJson"
                className="min-h-64 font-mono text-xs"
                value={jsonText}
                onChange={(event) => setJsonText(event.target.value)}
                placeholder="{ ... }"
              />
            </div>
            {issues.length ? (
              <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
                {issues.map((issue) => (
                  <p key={issue}>{issue}</p>
                ))}
              </div>
            ) : null}
            <DialogFooter>
              <Button disabled={!jsonText.trim() || pending} onClick={continueToPreview}>
                {pending ? "Validating..." : "Continue"}
              </Button>
            </DialogFooter>
          </div>
        ) : null}

        {step === 2 ? (
          <div className="grid max-h-[70vh] gap-4 overflow-y-auto pr-1">
            {issues.length ? (
              <div className="rounded-lg border bg-muted p-3 text-sm">
                {issues.map((issue) => (
                  <p key={issue}>{issue}</p>
                ))}
              </div>
            ) : null}
            <div className="grid gap-3 md:grid-cols-2">
              <div className="grid gap-2">
                <Label htmlFor="templateName">Name</Label>
                <Input id="templateName" value={name} onChange={(event) => setName(event.target.value)} />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="templateCategory">Category</Label>
                <select
                  id="templateCategory"
                  className="h-9 rounded-lg border bg-background px-2 text-sm"
                  value={category}
                  onChange={(event) => setCategory(event.target.value as typeof category)}
                >
                  {["inbound", "outbound", "test", "specialty"].map((item) => (
                    <option key={item} value={item}>
                      {item}
                    </option>
                  ))}
                </select>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="templatePurpose">Purpose</Label>
                <select
                  id="templatePurpose"
                  className="h-9 rounded-lg border bg-background px-2 text-sm"
                  value={purpose}
                  onChange={(event) => setPurpose(event.target.value as typeof purpose)}
                >
                  {purposes.map((item) => (
                    <option key={item} value={item}>
                      {item}
                    </option>
                  ))}
                </select>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="templateTags">Tags</Label>
                <Input
                  id="templateTags"
                  value={tags}
                  onChange={(event) => setTags(event.target.value)}
                  placeholder="inbound, michigan, intake"
                />
              </div>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="templateDescription">Description</Label>
              <Textarea
                id="templateDescription"
                value={description}
                onChange={(event) => setDescription(event.target.value)}
              />
            </div>
            <div className="grid gap-2">
              <p className="text-sm font-medium">Detected variables</p>
              {variables.length ? (
                variables.map((variable) => (
                  <div key={variable.name} className="grid gap-2 rounded-lg border p-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="font-mono text-sm">{variable.name}</span>
                      <label className="flex items-center gap-2 text-sm">
                        <input
                          type="checkbox"
                          checked={variable.required}
                          onChange={(event) =>
                            updateVariable(variable.name, { required: event.target.checked })
                          }
                        />
                        Required
                      </label>
                    </div>
                    <Input
                      value={variable.defaultValue}
                      onChange={(event) =>
                        updateVariable(variable.name, { defaultValue: event.target.value })
                      }
                      placeholder="Default value"
                    />
                  </div>
                ))
              ) : (
                <p className="text-sm text-muted-foreground">No placeholders detected.</p>
              )}
            </div>
            <DialogFooter>
              <Button variant="outline" disabled={pending} onClick={() => setStep(1)}>
                Back
              </Button>
              <Button disabled={pending || !name.trim()} onClick={saveTemplate}>
                {pending ? "Saving..." : "Save as template"}
              </Button>
            </DialogFooter>
          </div>
        ) : null}

        {step === 3 ? (
          <div className="grid gap-4">
            <div className="rounded-lg border bg-muted/50 p-4 text-sm">
              Template saved. You can now import it to Retell.
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => reset(false)}>
                Close
              </Button>
              <Button
                disabled={!savedTemplate}
                onClick={() => {
                  if (savedTemplate) {
                    reset(false);
                    onImportSavedTemplate(savedTemplate);
                  }
                }}
              >
                Import to Retell now
              </Button>
            </DialogFooter>
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
