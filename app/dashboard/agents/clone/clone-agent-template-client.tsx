"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { toast } from "sonner";
import {
  cloneFromRetellAgentId,
  saveUploadedTemplate,
  validateUploadedTemplate,
} from "@/app/dashboard/agents/actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

type VariableState = {
  name: string;
  required: boolean;
  defaultValue: string;
};

type Purpose =
  | "client_intake"
  | "caregiver_recruitment"
  | "reengagement"
  | "eligibility_followup"
  | "appointment_reminder"
  | "satisfaction_survey"
  | "general"
  | "test";

const MAX_FILE_BYTES = 500 * 1024;
const purposes: Purpose[] = [
  "client_intake",
  "caregiver_recruitment",
  "reengagement",
  "eligibility_followup",
  "appointment_reminder",
  "satisfaction_survey",
  "general",
  "test",
];

function parseTags(value: string) {
  return value
    .split(",")
    .map((tag) => tag.trim())
    .filter(Boolean);
}

function prettyJson(value: unknown) {
  return JSON.stringify(value ?? {}, null, 2);
}

function variableDefaults(variables: VariableState[]) {
  return Object.fromEntries(
    variables
      .filter((variable) => variable.defaultValue.trim())
      .map((variable) => [variable.name, variable.defaultValue.trim()])
  );
}

function TemplateSaveForm({
  payload,
  variables,
  setVariables,
  issues,
  name,
  setName,
  description,
  setDescription,
  category,
  setCategory,
  purpose,
  setPurpose,
  tags,
  setTags,
}: {
  payload: unknown;
  variables: VariableState[];
  setVariables: (variables: VariableState[]) => void;
  issues: string[];
  name: string;
  setName: (value: string) => void;
  description: string;
  setDescription: (value: string) => void;
  category: "inbound" | "outbound" | "test" | "specialty";
  setCategory: (value: "inbound" | "outbound" | "test" | "specialty") => void;
  purpose: Purpose;
  setPurpose: (value: Purpose) => void;
  tags: string;
  setTags: (value: string) => void;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const requiredVariables = useMemo(
    () => variables.filter((variable) => variable.required).map((variable) => variable.name),
    [variables]
  );

  function updateVariable(variable: string, patch: Partial<VariableState>) {
    setVariables(
      variables.map((item) => (item.name === variable ? { ...item, ...patch } : item))
    );
  }

  function saveTemplate() {
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
          default_variables: variableDefaults(variables),
        });
        toast.success("Template saved. You can now import it to Retell.");
        router.push(`/dashboard/agents/${result.template_id}/edit`);
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Unable to save template.");
      }
    });
  }

  return (
    <div className="grid gap-4">
      {issues.length ? (
        <Card className="grid gap-1 p-3 text-sm text-muted-foreground">
          {issues.map((issue) => (
            <p key={issue}>{issue}</p>
          ))}
        </Card>
      ) : null}

      <div className="grid gap-3 md:grid-cols-2">
        <label className="grid gap-1">
          <Label>Name</Label>
          <Input value={name} onChange={(event) => setName(event.target.value)} required />
        </label>
        <label className="grid gap-1">
          <Label>Tags</Label>
          <Input
            value={tags}
            onChange={(event) => setTags(event.target.value)}
            placeholder="cloned, retell"
          />
        </label>
        <label className="grid gap-1">
          <Label>Category</Label>
          <select
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
        </label>
        <label className="grid gap-1">
          <Label>Purpose</Label>
          <select
            className="h-9 rounded-lg border bg-background px-2 text-sm"
            value={purpose}
            onChange={(event) => setPurpose(event.target.value as Purpose)}
          >
            {purposes.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
        </label>
      </div>

      <label className="grid gap-1">
        <Label>Description</Label>
        <Textarea value={description} onChange={(event) => setDescription(event.target.value)} />
      </label>

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

      <details className="rounded-lg border p-3">
        <summary className="cursor-pointer text-sm font-medium">Preview Retell JSON</summary>
        <pre className="mt-3 max-h-96 overflow-auto rounded-lg bg-muted p-3 text-xs">
          {prettyJson(payload)}
        </pre>
      </details>

      <div className="flex justify-end">
        <Button disabled={pending || !name.trim()} onClick={saveTemplate}>
          {pending ? "Saving..." : "Save as template"}
        </Button>
      </div>
    </div>
  );
}

function CloneFromFile() {
  const [pending, startTransition] = useTransition();
  const [jsonText, setJsonText] = useState("");
  const [issues, setIssues] = useState<string[]>([]);
  const [payload, setPayload] = useState<unknown>(null);
  const [variables, setVariables] = useState<VariableState[]>([]);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState<"inbound" | "outbound" | "test" | "specialty">(
    "inbound"
  );
  const [purpose, setPurpose] = useState<Purpose>("general");
  const [tags, setTags] = useState("cloned,json");

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

  function validate() {
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
        setName(result.payload.agent_name ?? "Cloned Agent Template");
        setTags("cloned,json,retell");
      }
    });
  }

  return (
    <Card className="grid gap-4 p-4">
      <div>
        <h2 className="font-medium">Clone from file</h2>
        <p className="text-sm text-muted-foreground">
          Upload a Retell export JSON file or paste JSON from another source.
        </p>
      </div>
      <div className="grid gap-2">
        <Label htmlFor="cloneFile">JSON file</Label>
        <Input
          id="cloneFile"
          type="file"
          accept="application/json,.json"
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) void readFile(file);
          }}
        />
      </div>
      <label className="grid gap-1">
        <Label>Paste JSON</Label>
        <Textarea
          className="min-h-64 font-mono text-xs"
          value={jsonText}
          onChange={(event) => setJsonText(event.target.value)}
          placeholder="{ ... }"
        />
      </label>
      <div className="flex justify-end">
        <Button disabled={pending || !jsonText.trim()} onClick={validate}>
          {pending ? "Validating..." : "Preview & metadata"}
        </Button>
      </div>
      {payload ? (
        <TemplateSaveForm
          payload={payload}
          variables={variables}
          setVariables={setVariables}
          issues={issues}
          name={name}
          setName={setName}
          description={description}
          setDescription={setDescription}
          category={category}
          setCategory={setCategory}
          purpose={purpose}
          setPurpose={setPurpose}
          tags={tags}
          setTags={setTags}
        />
      ) : issues.length ? (
        <Card className="grid gap-1 border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
          {issues.map((issue) => (
            <p key={issue}>{issue}</p>
          ))}
        </Card>
      ) : null}
    </Card>
  );
}

function CloneFromRetellAgentId() {
  const [pending, startTransition] = useTransition();
  const [agentId, setAgentId] = useState("");
  const [issues, setIssues] = useState<string[]>([]);
  const [payload, setPayload] = useState<unknown>(null);
  const [variables, setVariables] = useState<VariableState[]>([]);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState<"inbound" | "outbound" | "test" | "specialty">(
    "inbound"
  );
  const [purpose, setPurpose] = useState<Purpose>("general");
  const [tags, setTags] = useState("retell,cloned");

  function clone() {
    startTransition(async () => {
      try {
        const result = await cloneFromRetellAgentId({ agent_id: agentId });
        setPayload(result.payload);
        setIssues(result.issues);
        setVariables(
          result.suggested_variables
            .filter((variable) => variable !== "webhook_base_url")
            .map((variable) => ({
              name: variable,
              required: true,
              defaultValue: "",
            }))
        );
        setName(result.metadata.name);
        setDescription(result.metadata.description);
        setCategory(result.metadata.category);
        setPurpose(result.metadata.purpose);
        setTags(result.metadata.tags.join(", "));
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Unable to clone Retell agent.");
      }
    });
  }

  return (
    <Card className="grid gap-4 p-4">
      <div>
        <h2 className="font-medium">Clone from Retell agent ID</h2>
        <p className="text-sm text-muted-foreground">
          Export an agent available to the current Retell API key and save it as a reusable
          template.
        </p>
      </div>
      <div className="grid gap-2 md:grid-cols-[1fr_auto]">
        <label className="grid gap-1">
          <Label>Retell agent ID</Label>
          <Input
            value={agentId}
            onChange={(event) => setAgentId(event.target.value)}
            placeholder="agent_..."
          />
        </label>
        <Button className="self-end" disabled={pending || !agentId.trim()} onClick={clone}>
          {pending ? "Exporting..." : "Load agent"}
        </Button>
      </div>
      {payload ? (
        <TemplateSaveForm
          payload={payload}
          variables={variables}
          setVariables={setVariables}
          issues={issues}
          name={name}
          setName={setName}
          description={description}
          setDescription={setDescription}
          category={category}
          setCategory={setCategory}
          purpose={purpose}
          setPurpose={setPurpose}
          tags={tags}
          setTags={setTags}
        />
      ) : null}
    </Card>
  );
}

export function CloneAgentTemplateClient() {
  return (
    <Tabs defaultValue="file" className="grid gap-4">
      <TabsList>
        <TabsTrigger value="file">From file</TabsTrigger>
        <TabsTrigger value="retell">From Retell agent ID</TabsTrigger>
        <Tooltip>
          <TooltipTrigger>
            <TabsTrigger value="url" disabled>
              From another tenant&apos;s export URL
            </TabsTrigger>
          </TooltipTrigger>
          <TooltipContent>Coming soon — shareable template URLs across agencies.</TooltipContent>
        </Tooltip>
      </TabsList>

      <TabsContent value="file">
        <CloneFromFile />
      </TabsContent>
      <TabsContent value="retell">
        <CloneFromRetellAgentId />
      </TabsContent>
      <TabsContent value="url">
        <Card className="p-6 text-sm text-muted-foreground">
          Shareable template URLs are coming soon.
        </Card>
      </TabsContent>
      <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
        <Badge variant="outline">No new tables</Badge>
        <Badge variant="outline">Uses existing upload/import logic</Badge>
      </div>
    </Tabs>
  );
}
