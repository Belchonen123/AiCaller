"use client";

import CodeMirror from "@uiw/react-codemirror";
import { json } from "@codemirror/lang-json";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { toast } from "sonner";
import {
  updateImportedRetellAgents,
  updateTemplate,
} from "@/app/dashboard/agents/actions";
import type { AgentTemplateRow } from "@/app/dashboard/agents/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

type EditTemplateFormProps = {
  template: AgentTemplateRow;
};

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

function parseList(value: string) {
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function parseDefaults(value: string) {
  const parsed = JSON.parse(value) as unknown;
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("Default variables must be a JSON object.");
  }

  return Object.fromEntries(
    Object.entries(parsed).map(([key, item]) => [key, String(item ?? "")])
  );
}

export function EditTemplateForm({ template }: EditTemplateFormProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [name, setName] = useState(template.name);
  const [description, setDescription] = useState(template.description ?? "");
  const [category, setCategory] = useState(template.category);
  const [purpose, setPurpose] = useState(template.purpose ?? "general");
  const [tags, setTags] = useState((template.tags ?? []).join(", "));
  const [requiredVariables, setRequiredVariables] = useState(
    (template.required_variables ?? []).join(", ")
  );
  const [defaultVariables, setDefaultVariables] = useState(
    JSON.stringify(template.default_variables ?? {}, null, 2)
  );
  const [payloadText, setPayloadText] = useState(
    JSON.stringify(template.retell_payload ?? {}, null, 2)
  );
  const importedAgentCount = template.imported_agent_ids?.length ?? 0;
  const jsonIssue = useMemo(() => {
    try {
      JSON.parse(payloadText);
      parseDefaults(defaultVariables);
      return null;
    } catch (error) {
      return error instanceof Error ? error.message : "Invalid JSON.";
    }
  }, [defaultVariables, payloadText]);

  function buildUpdateInput() {
    return {
      template_id: template.id,
      metadata: {
        name,
        description,
        category,
        purpose,
        tags: parseList(tags),
        required_variables: parseList(requiredVariables),
        default_variables: parseDefaults(defaultVariables),
      },
      retell_payload: JSON.parse(payloadText) as unknown,
    };
  }

  function save() {
    if (jsonIssue) {
      toast.error(jsonIssue);
      return;
    }

    startTransition(async () => {
      try {
        await updateTemplate(buildUpdateInput());
        toast.success("Template saved.");
        router.refresh();
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Unable to save template.");
      }
    });
  }

  function saveAndReimport() {
    if (jsonIssue) {
      toast.error(jsonIssue);
      return;
    }

    if (
      !window.confirm(
        `Save this template and update ${importedAgentCount} linked Retell ${
          importedAgentCount === 1 ? "agent" : "agents"
        }?`
      )
    ) {
      return;
    }

    startTransition(async () => {
      try {
        await updateTemplate(buildUpdateInput());
        await updateImportedRetellAgents({ template_id: template.id });
        toast.success("Template saved and linked Retell agents updated.");
        router.refresh();
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Unable to update linked agents.");
      }
    });
  }

  return (
    <div className="grid gap-4">
      <Card className="grid gap-4 p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="font-medium">Metadata</h2>
            <p className="text-sm text-muted-foreground">
              Version {template.version}. Slug:{" "}
              <span className="font-mono">{template.slug}</span>
            </p>
          </div>
          {importedAgentCount ? (
            <Badge variant="secondary">
              {importedAgentCount} linked Retell{" "}
              {importedAgentCount === 1 ? "agent" : "agents"}
            </Badge>
          ) : null}
        </div>
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
              onChange={(event) => setCategory(event.target.value)}
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
              onChange={(event) => setPurpose(event.target.value)}
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
            <Input value={tags} onChange={(event) => setTags(event.target.value)} />
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
        <div className="grid gap-3 md:grid-cols-2">
          <div className="grid gap-2">
            <Label htmlFor="requiredVariables">Required variables</Label>
            <Input
              id="requiredVariables"
              value={requiredVariables}
              onChange={(event) => setRequiredVariables(event.target.value)}
              placeholder="agency_name, agency_callback_hours"
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="defaultVariables">Default variables JSON</Label>
            <Textarea
              id="defaultVariables"
              className="min-h-28 font-mono text-xs"
              value={defaultVariables}
              onChange={(event) => setDefaultVariables(event.target.value)}
            />
          </div>
        </div>
      </Card>

      <Card className="grid gap-3 p-4">
        <div>
          <h2 className="font-medium">Retell payload</h2>
          <p className="text-sm text-muted-foreground">
            JSON schema hints are enforced on save through the Retell payload validator.
          </p>
        </div>
        {jsonIssue ? (
          <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
            {jsonIssue}
          </div>
        ) : null}
        <CodeMirror
          value={payloadText}
          height="520px"
          extensions={[json()]}
          basicSetup={{
            foldGutter: true,
            autocompletion: true,
            lintKeymap: true,
          }}
          onChange={(value) => setPayloadText(value)}
        />
      </Card>

      <div className="flex flex-wrap justify-end gap-2">
        <Button variant="outline" onClick={() => router.push("/dashboard/agents")}>
          Cancel
        </Button>
        <Button disabled={pending || Boolean(jsonIssue) || !name.trim()} onClick={save}>
          {pending ? "Saving..." : "Save"}
        </Button>
        {importedAgentCount ? (
          <Button disabled={pending || Boolean(jsonIssue)} onClick={saveAndReimport}>
            Save and re-import
          </Button>
        ) : null}
      </div>
    </div>
  );
}
