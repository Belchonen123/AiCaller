"use client";

import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import * as Papa from "papaparse";
import { toast } from "sonner";
import {
  importCallingListCampaign,
  validateImportCsv,
  type CsvValidationResult,
} from "@/app/dashboard/campaigns/actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getRetellPhoneNumberAgentIds } from "@/lib/retell/connection-state";

type AgentOption = {
  agent_id: string;
  agent_name?: string | null;
  name?: string | null;
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

type TemplateVariables = {
  agent_id: string;
  template_name: string;
  required_variables: string[];
  default_variables: Record<string, unknown>;
};

type PreviewRow = Record<string, string>;

type MappingState = Record<
  string,
  | { mode: "fixed"; value: string }
  | { mode: "column"; column: string }
  | { mode: "default" }
>;

const maxFileBytes = 2 * 1024 * 1024;
const phoneCandidates = ["phone", "to_phone", "number", "phone_number", "mobile", "cell"];
const nameCandidates = ["name", "full_name", "contact_name", "client_name"];
const purposes = [
  "reengagement",
  "followup",
  "referral_followup",
  "caregiver_recruitment",
  "eligibility_check",
  "general_outreach",
  "test",
] as const;
const steps = [
  "Upload your CSV",
  "Configure the campaign",
  "Map template variables",
  "Review and launch",
] as const;

function detectColumn(headers: string[], candidates: string[]) {
  const normalized = new Map(headers.map((header) => [header.trim().toLowerCase(), header]));
  return candidates.find((candidate) => normalized.has(candidate))
    ? normalized.get(candidates.find((candidate) => normalized.has(candidate)) ?? "") ?? ""
    : "";
}

function parsePreview(csvText: string) {
  const parsed = Papa.parse<PreviewRow>(csvText, {
    preview: 5,
    header: true,
    skipEmptyLines: true,
    transformHeader: (header) => header.trim(),
  });

  return {
    headers: parsed.meta.fields?.filter(Boolean) ?? [],
    rows: parsed.data ?? [],
  };
}

function readFileText(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ""));
    reader.onerror = () => reject(new Error("Unable to read CSV file"));
    reader.readAsText(file);
  });
}

function agentLabel(agent: AgentOption) {
  return agent.agent_name ?? agent.name ?? agent.agent_id;
}

export function ImportCallingListWizard({
  agents,
  phoneNumbers,
  templateVariables,
}: {
  agents: AgentOption[];
  phoneNumbers: PhoneNumberOption[];
  templateVariables: TemplateVariables[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);
  const [dragging, setDragging] = useState(false);
  const [fileName, setFileName] = useState("");
  const [fileText, setFileText] = useState("");
  const [headers, setHeaders] = useState<string[]>([]);
  const [previewRows, setPreviewRows] = useState<PreviewRow[]>([]);
  const [phoneColumn, setPhoneColumn] = useState("");
  const [nameColumn, setNameColumn] = useState("");
  const [validation, setValidation] = useState<CsvValidationResult | null>(null);
  const [campaignName, setCampaignName] = useState("");
  const [purpose, setPurpose] = useState<(typeof purposes)[number]>("followup");
  const [selectedAgentId, setSelectedAgentId] = useState(agents[0]?.agent_id ?? "");
  const linkedPhoneNumbers = useMemo(
    () =>
      phoneNumbers.filter((phoneNumber) =>
        getRetellPhoneNumberAgentIds(phoneNumber).includes(selectedAgentId)
      ),
    [phoneNumbers, selectedAgentId]
  );
  const [selectedFromPhone, setSelectedFromPhone] = useState(
    linkedPhoneNumbers[0]?.phone_number ?? ""
  );
  const [maxConcurrent, setMaxConcurrent] = useState(1);
  const [maxAttempts, setMaxAttempts] = useState(3);
  const [retryDelay, setRetryDelay] = useState(60);
  const [windowStart, setWindowStart] = useState("09:00");
  const [windowEnd, setWindowEnd] = useState("20:00");
  const [timezone, setTimezone] = useState("America/Detroit");
  const selectedTemplate = templateVariables.find(
    (template) => template.agent_id === selectedAgentId
  );
  const requiredVariables = selectedTemplate?.required_variables ?? [];
  const [mapping, setMapping] = useState<MappingState>({});

  function setAgent(agentId: string) {
    setSelectedAgentId(agentId);
    const nextPhone = phoneNumbers.find((phoneNumber) =>
      getRetellPhoneNumberAgentIds(phoneNumber).includes(agentId)
    );
    setSelectedFromPhone(nextPhone?.phone_number ?? "");
  }

  async function handleFile(file: File | undefined) {
    if (!file) {
      return;
    }

    if (!file.name.toLowerCase().endsWith(".csv")) {
      toast.error("Upload a .csv file.");
      return;
    }

    if (file.size > maxFileBytes) {
      toast.error("CSV must be 2MB or smaller.");
      return;
    }

    const text = await readFileText(file);
    const preview = parsePreview(text);
    setFileName(file.name);
    setFileText(text);
    setHeaders(preview.headers);
    setPreviewRows(preview.rows);
    setPhoneColumn(detectColumn(preview.headers, phoneCandidates));
    setNameColumn(detectColumn(preview.headers, nameCandidates));
    setValidation(null);
  }

  function validateCsv() {
    if (!fileText || !phoneColumn) {
      toast.error("Select a CSV and phone column first.");
      return;
    }

    startTransition(async () => {
      const result = await validateImportCsv({
        file_text: fileText,
        phone_column: phoneColumn,
        name_column: nameColumn || undefined,
      });

      if (!result.ok) {
        toast.error(result.message);
        return;
      }

      setValidation(result);
      setCampaignName((current) => current || fileName.replace(/\.csv$/i, ""));
      setStep(2);
    });
  }

  function configureLater() {
    if (!campaignName) {
      setCampaignName(fileName.replace(/\.csv$/i, "") || "Imported calling list");
    }
    setStep(4);
  }

  function updateMapping(variable: string, next: MappingState[string]) {
    setMapping((current) => ({ ...current, [variable]: next }));
  }

  function buildScriptVariables() {
    const defaults: Record<string, unknown> = {};
    for (const variable of requiredVariables) {
      const item = mapping[variable];
      if (item?.mode === "fixed") {
        defaults[variable] = item.value;
      } else if (item?.mode === "default" && selectedTemplate?.default_variables[variable] !== undefined) {
        defaults[variable] = selectedTemplate.default_variables[variable];
      }
    }

    return defaults;
  }

  function save(status: "draft" | "running") {
    if (!validation || !campaignName || !selectedAgentId || !selectedFromPhone) {
      toast.error("Finish the required campaign details first.");
      return;
    }

    startTransition(async () => {
      const result = await importCallingListCampaign({
        name: campaignName,
        purpose,
        description: "",
        agent_id: selectedAgentId,
        from_phone: selectedFromPhone,
        script_variables: JSON.stringify(buildScriptVariables()),
        max_concurrent: maxConcurrent,
        max_attempts_per_task: maxAttempts,
        retry_delay_minutes: retryDelay,
        call_window_start: windowStart,
        call_window_end: windowEnd,
        call_window_timezone: timezone,
        file_text: fileText,
        phone_column: phoneColumn,
        name_column: nameColumn || undefined,
        filename: fileName,
        status,
        variable_mapping: mapping,
      });

      if (!result.ok || !result.campaign_id) {
        toast.error(result.message);
        return;
      }

      toast.success(result.message);
      router.push(`/dashboard/campaigns/${result.campaign_id}`);
    });
  }

  return (
    <Card elevation="raised" padding="comfortable" className="gap-6">
      <div className="grid gap-2 md:grid-cols-4">
        {steps.map((label, index) => {
          const number = index + 1;
          const active = step === number;
          const complete = step > number;
          return (
            <div
              key={label}
              className={`rounded-lg border px-3 py-2 text-sm ${
                active
                  ? "border-accent-secondary bg-[color-mix(in_oklch,var(--color-accent-secondary)_10%,transparent)]"
                  : complete
                    ? "border-success-border bg-success-bg text-success-fg"
                    : "border-border-subtle bg-bg-surface-sunken text-fg-tertiary"
              }`}
            >
              <span className="font-semibold">Step {number}</span>
              <span className="block">{label}</span>
            </div>
          );
        })}
      </div>

      {step === 1 ? (
        <div className="grid gap-4">
          <div
            className={`rounded-xl border border-dashed p-8 text-center transition-colors ${
              dragging ? "border-border-emphasis bg-bg-emphasis" : "border-border-default"
            }`}
            onDragEnter={() => setDragging(true)}
            onDragLeave={() => setDragging(false)}
            onDragOver={(event) => event.preventDefault()}
            onDrop={(event) => {
              event.preventDefault();
              setDragging(false);
              void handleFile(event.dataTransfer.files[0]);
            }}
          >
            <p className="font-heading text-xl font-semibold">Upload your CSV</p>
            <p className="mb-4 text-sm text-fg-secondary">CSV only, max 2 MB.</p>
            <Input
              type="file"
              accept=".csv,text/csv"
              onChange={(event) => void handleFile(event.target.files?.[0])}
            />
          </div>

          {headers.length > 0 ? (
            <div className="grid gap-4">
              <div className="flex flex-wrap gap-2">
                {headers.map((header) => (
                  <Badge key={header} variant="outline">
                    {header}
                  </Badge>
                ))}
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                <label className="grid gap-1">
                  <Label>Phone column</Label>
                  <select
                    value={phoneColumn}
                    onChange={(event) => setPhoneColumn(event.target.value)}
                    className="h-9 rounded-lg border bg-background px-2 text-sm"
                  >
                    <option value="">Select phone column</option>
                    {headers.map((header) => (
                      <option key={header} value={header}>
                        {header}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="grid gap-1">
                  <Label>Name column</Label>
                  <select
                    value={nameColumn}
                    onChange={(event) => setNameColumn(event.target.value)}
                    className="h-9 rounded-lg border bg-background px-2 text-sm"
                  >
                    <option value="">No name column</option>
                    {headers.map((header) => (
                      <option key={header} value={header}>
                        {header}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <PreviewTable headers={headers} rows={previewRows} />
            </div>
          ) : null}

          <div className="flex justify-end">
            <Button type="button" disabled={!fileText || !phoneColumn || pending} onClick={validateCsv}>
              {pending ? "Validating..." : "Continue"}
            </Button>
          </div>
        </div>
      ) : null}

      {step === 2 && validation ? (
        <div className="grid gap-4">
          <div className="rounded-lg border bg-bg-surface-sunken p-3">
            Found {validation.accepted_count} valid numbers and {validation.rejected_count} bad rows.
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            <label className="grid gap-1">
              <Label>Campaign name</Label>
              <Input value={campaignName} required onChange={(event) => setCampaignName(event.target.value)} />
            </label>
            <label className="grid gap-1">
              <Label>Purpose</Label>
              <select
                value={purpose}
                onChange={(event) => setPurpose(event.target.value as typeof purpose)}
                className="h-9 rounded-lg border bg-background px-2 text-sm"
              >
                {purposes.map((item) => (
                  <option key={item} value={item}>
                    {item.replaceAll("_", " ")}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            <label className="grid gap-1">
              <Label>Agent</Label>
              {agents.length > 0 ? (
                <select
                  value={selectedAgentId}
                  onChange={(event) => setAgent(event.target.value)}
                  className="h-9 rounded-lg border bg-background px-2 text-sm"
                >
                  {agents.map((agent) => (
                    <option key={agent.agent_id} value={agent.agent_id}>
                      {agentLabel(agent)}
                    </option>
                  ))}
                </select>
              ) : (
                <Button variant="secondary" render={<Link href="/dashboard/agents" />}>
                  Import a template first
                </Button>
              )}
            </label>
            <label className="grid gap-1">
              <Label>From phone</Label>
              <select
                value={selectedFromPhone}
                onChange={(event) => setSelectedFromPhone(event.target.value)}
                className="h-9 rounded-lg border bg-background px-2 text-sm"
              >
                <option value="">Select a number linked to this agent</option>
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
          <div className="grid gap-3 md:grid-cols-3">
            <NumberField label="Max concurrent" value={maxConcurrent} setValue={setMaxConcurrent} />
            <NumberField label="Max attempts" value={maxAttempts} setValue={setMaxAttempts} />
            <NumberField label="Retry delay minutes" value={retryDelay} setValue={setRetryDelay} />
          </div>
          <div className="grid gap-3 md:grid-cols-3">
            <label className="grid gap-1">
              <Label>Call window start</Label>
              <Input type="time" value={windowStart} onChange={(event) => setWindowStart(event.target.value)} />
            </label>
            <label className="grid gap-1">
              <Label>Call window end</Label>
              <Input type="time" value={windowEnd} onChange={(event) => setWindowEnd(event.target.value)} />
            </label>
            <label className="grid gap-1">
              <Label>Timezone</Label>
              <Input value={timezone} onChange={(event) => setTimezone(event.target.value)} />
            </label>
          </div>
          <div className="flex flex-wrap justify-between gap-2">
            <Button type="button" variant="secondary" onClick={configureLater}>
              Configure later
            </Button>
            <Button
              type="button"
              disabled={!campaignName || !selectedAgentId || !selectedFromPhone}
              onClick={() => setStep(3)}
            >
              Continue
            </Button>
          </div>
        </div>
      ) : null}

      {step === 3 ? (
        <div className="grid gap-4">
          {requiredVariables.length > 0 ? (
            requiredVariables.map((variable) => (
              <VariableMappingRow
                key={variable}
                variable={variable}
                headers={headers}
                defaultValue={selectedTemplate?.default_variables[variable]}
                value={mapping[variable] ?? { mode: "default" }}
                onChange={(next) => updateMapping(variable, next)}
              />
            ))
          ) : (
            <p className="rounded-lg border bg-bg-surface-sunken p-3 text-sm text-fg-secondary">
              This agent has no imported template variables. CSV columns will still be available as row merge fields.
            </p>
          )}
          <div className="flex justify-end">
            <Button type="button" onClick={() => setStep(4)}>
              Continue
            </Button>
          </div>
        </div>
      ) : null}

      {step === 4 && validation ? (
        <div className="grid gap-4">
          <Card padding="compact">
            <dl className="grid gap-2 text-sm md:grid-cols-2">
              <SummaryItem label="Campaign" value={campaignName || "Imported calling list"} />
              <SummaryItem label="Agent" value={selectedAgentId} />
              <SummaryItem label="From phone" value={selectedFromPhone} />
              <SummaryItem label="Total tasks" value={validation.accepted_count} />
              <SummaryItem label="Call window" value={`${windowStart}-${windowEnd} ${timezone}`} />
              <SummaryItem label="Rejected rows" value={validation.rejected_count} />
            </dl>
          </Card>
          <div className="flex flex-wrap justify-end gap-2">
            <Button type="button" variant="secondary" disabled={pending} onClick={() => save("draft")}>
              Save as draft
            </Button>
            <Button type="button" disabled={pending} onClick={() => save("running")}>
              Save and start calling
            </Button>
          </div>
        </div>
      ) : null}
    </Card>
  );
}

function PreviewTable({ headers, rows }: { headers: string[]; rows: PreviewRow[] }) {
  return (
    <div className="overflow-x-auto rounded-lg border">
      <table className="w-full min-w-[600px] text-xs">
        <thead className="bg-muted/50 text-left">
          <tr>
            {headers.map((header) => (
              <th key={header} className="p-2">
                {header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr key={index} className="border-t">
              {headers.map((header) => (
                <td key={header} className="p-2">
                  {row[header] ?? ""}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function NumberField({
  label,
  value,
  setValue,
}: {
  label: string;
  value: number;
  setValue: (value: number) => void;
}) {
  return (
    <label className="grid gap-1">
      <Label>{label}</Label>
      <Input
        type="number"
        min={1}
        value={value}
        onChange={(event) => setValue(Number(event.target.value))}
      />
    </label>
  );
}

function VariableMappingRow({
  variable,
  headers,
  defaultValue,
  value,
  onChange,
}: {
  variable: string;
  headers: string[];
  defaultValue: unknown;
  value: MappingState[string];
  onChange: (value: MappingState[string]) => void;
}) {
  return (
    <div className="grid gap-3 rounded-lg border border-border-default p-3">
      <p className="font-medium">{variable}</p>
      <div className="grid gap-3 md:grid-cols-3">
        <label className="flex items-center gap-2 text-sm">
          <input
            type="radio"
            checked={value.mode === "fixed"}
            onChange={() => onChange({ mode: "fixed", value: "" })}
          />
          Use fixed value
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="radio"
            checked={value.mode === "column"}
            onChange={() => onChange({ mode: "column", column: headers[0] ?? "" })}
          />
          Map from CSV column
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="radio"
            checked={value.mode === "default"}
            onChange={() => onChange({ mode: "default" })}
          />
          Use template default
        </label>
      </div>
      {value.mode === "fixed" ? (
        <Input
          value={value.value}
          placeholder={`Value for ${variable}`}
          onChange={(event) => onChange({ mode: "fixed", value: event.target.value })}
        />
      ) : null}
      {value.mode === "column" ? (
        <select
          value={value.column}
          className="h-9 rounded-lg border bg-background px-2 text-sm"
          onChange={(event) => onChange({ mode: "column", column: event.target.value })}
        >
          {headers.map((header) => (
            <option key={header} value={header}>
              {header}
            </option>
          ))}
        </select>
      ) : null}
      {value.mode === "default" ? (
        <p className="text-xs text-fg-tertiary">
          Default: {defaultValue === undefined ? "No template default" : String(defaultValue)}
        </p>
      ) : null}
    </div>
  );
}

function SummaryItem({ label, value }: { label: string; value: string | number }) {
  return (
    <div>
      <dt className="text-xs font-medium tracking-wide text-fg-tertiary uppercase">{label}</dt>
      <dd className="mt-1 font-medium">{value || "Not set"}</dd>
    </div>
  );
}
