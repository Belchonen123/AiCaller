"use client";

import * as Papa from "papaparse";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { toast } from "sonner";
import {
  parseAndValidateCsv,
  uploadCsvToCampaign,
  type CsvValidationResult,
} from "@/app/dashboard/campaigns/actions";
import { Badge } from "@/components/ui/badge";
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

type UploadDialogProps = {
  campaignId: string;
  campaignName: string;
  trigger?: React.ReactNode;
  triggerVariant?: "default" | "primary" | "secondary" | "outline" | "accent";
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  onUploaded?: (result: { accepted: number; rejected: number; filename: string }) => void;
};

type PreviewRow = Record<string, string>;

const maxFileBytes = 2 * 1024 * 1024;
const phoneCandidates = ["phone", "to_phone", "number", "phone_number", "mobile", "cell"];
const nameCandidates = ["name", "full_name", "contact_name", "client_name"];
const templateCsv =
  "phone,name,client_name,client_status,notes\n+13135550101,Jane Example,Jane Example,interested,Synthetic example row";

function detectColumn(headers: string[], candidates: string[]) {
  const normalized = new Map(headers.map((header) => [header.trim().toLowerCase(), header]));
  for (const candidate of candidates) {
    const match = normalized.get(candidate);
    if (match) {
      return match;
    }
  }
  return "";
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

export function CampaignUploadDialog({
  campaignId,
  campaignName,
  trigger,
  triggerVariant = "outline",
  open,
  onOpenChange,
  onUploaded,
}: UploadDialogProps) {
  const router = useRouter();
  const [internalOpen, setInternalOpen] = useState(false);
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [pending, startTransition] = useTransition();
  const [fileName, setFileName] = useState("");
  const [fileText, setFileText] = useState("");
  const [headers, setHeaders] = useState<string[]>([]);
  const [previewRows, setPreviewRows] = useState<PreviewRow[]>([]);
  const [phoneColumn, setPhoneColumn] = useState("");
  const [nameColumn, setNameColumn] = useState("");
  const [validation, setValidation] = useState<CsvValidationResult | null>(null);
  const [uploading, setUploading] = useState(false);
  const [dragging, setDragging] = useState(false);
  const templateHref = useMemo(
    () => `data:text/csv;charset=utf-8,${encodeURIComponent(templateCsv)}`,
    []
  );
  const dialogOpen = open ?? internalOpen;

  function setDialogOpen(nextOpen: boolean) {
    onOpenChange?.(nextOpen);
    if (open === undefined) {
      setInternalOpen(nextOpen);
    }
  }

  function reset() {
    setStep(1);
    setFileName("");
    setFileText("");
    setHeaders([]);
    setPreviewRows([]);
    setPhoneColumn("");
    setNameColumn("");
    setValidation(null);
    setUploading(false);
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

    try {
      const text = await readFileText(file);
      const preview = parsePreview(text);
      setFileName(file.name);
      setFileText(text);
      setHeaders(preview.headers);
      setPreviewRows(preview.rows);
      setPhoneColumn(detectColumn(preview.headers, phoneCandidates));
      setNameColumn(detectColumn(preview.headers, nameCandidates));
      setValidation(null);
    } catch {
      toast.error("Unable to read CSV file.");
    }
  }

  function validateCsv() {
    if (!fileText || !phoneColumn) {
      toast.error("Select a CSV and phone column first.");
      return;
    }

    startTransition(async () => {
      const result = await parseAndValidateCsv({
        campaign_id: campaignId,
        file_text: fileText,
        phone_column: phoneColumn,
        name_column: nameColumn || undefined,
      });

      if (!result.ok) {
        toast.error(result.message);
        return;
      }

      setValidation(result);
      setStep(2);
    });
  }

  async function uploadCsv() {
    if (!validation || uploading) {
      return;
    }

    setUploading(true);
    const result = await uploadCsvToCampaign({
      campaign_id: campaignId,
      file_text: fileText,
      phone_column: phoneColumn,
      name_column: nameColumn || undefined,
      filename: fileName,
    });

    if (result.ok) {
      toast.success(result.message);
      setDialogOpen(false);
      reset();
      if (onUploaded) {
        onUploaded({
          accepted: result.accepted ?? 0,
          rejected: result.rejected ?? 0,
          filename: fileName,
        });
      } else {
        router.refresh();
      }
    } else {
      toast.error(result.message);
      setUploading(false);
    }
  }

  return (
    <Dialog
      open={dialogOpen}
      onOpenChange={(nextOpen) => {
        setDialogOpen(nextOpen);
        if (!nextOpen) reset();
      }}
    >
      {trigger === null ? null : (
        <DialogTrigger render={<Button variant={triggerVariant} />}>
          {trigger ?? "Add tasks from CSV"}
        </DialogTrigger>
      )}
      <DialogContent className="sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>Add tasks from CSV</DialogTitle>
          <DialogDescription>
            Upload a call list, validate phone numbers, then add accepted rows as queued tasks.
          </DialogDescription>
        </DialogHeader>
        <div className="rounded-lg border border-info-border bg-info-bg p-3 text-sm text-info-fg">
          All data uploaded here is scoped to your agency tenant. Other agencies cannot access it.
        </div>

        <div className="grid grid-cols-3 gap-2">
          {[
            [1, "File drop"],
            [2, "Column mapping"],
            [3, "Confirm"],
          ].map(([stepNumber, label]) => (
            <div
              key={stepNumber}
              className={`rounded-lg border px-3 py-2 text-xs ${
                step === stepNumber
                  ? "border-accent-secondary bg-[color-mix(in_oklch,var(--color-accent-secondary)_10%,transparent)] text-fg-primary"
                  : "border-border-subtle bg-bg-surface-sunken text-fg-tertiary"
              }`}
            >
              <span className="font-semibold">Step {stepNumber}</span>
              <span className="block">{label}</span>
            </div>
          ))}
        </div>

        {step === 1 ? (
          <div className="grid gap-4">
            <div
              className={`rounded-xl border border-dashed p-6 text-center transition-colors ${
                dragging
                  ? "border-border-emphasis bg-bg-emphasis"
                  : "border-border-default bg-bg-surface"
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
              <p className="font-medium">Drop a CSV here, or choose a file</p>
              <p className="mb-3 text-sm text-muted-foreground">CSV only, max 2MB.</p>
              <Input
                type="file"
                accept=".csv,text/csv"
                onChange={(event) => void handleFile(event.target.files?.[0])}
              />
              <a
                className="mt-3 inline-block text-sm underline"
                href={templateHref}
                download="campaign-call-list-template.csv"
              >
                Download template CSV
              </a>
            </div>

            {headers.length > 0 ? (
              <div className="grid gap-3">
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
                      className="h-8 rounded-lg border bg-background px-2 text-sm"
                    >
                      <option value="">Select phone column</option>
                      {headers.map((header) => (
                        <option key={header} value={header}>
                          {header}
                        </option>
                      ))}
                    </select>
                    {phoneColumn ? (
                      <span className="text-xs text-success-fg">Auto-detected {phoneColumn}</span>
                    ) : (
                      <span className="text-xs text-warning-fg">Select the phone column</span>
                    )}
                  </label>
                  <label className="grid gap-1">
                    <Label>Name column</Label>
                    <select
                      value={nameColumn}
                      onChange={(event) => setNameColumn(event.target.value)}
                      className="h-8 rounded-lg border bg-background px-2 text-sm"
                    >
                      <option value="">No name column</option>
                      {headers.map((header) => (
                        <option key={header} value={header}>
                          {header}
                        </option>
                      ))}
                    </select>
                    {nameColumn ? (
                      <span className="text-xs text-success-fg">Auto-detected {nameColumn}</span>
                    ) : (
                      <span className="text-xs text-fg-tertiary">Optional</span>
                    )}
                  </label>
                </div>
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
                      {previewRows.map((row, index) => (
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
              </div>
            ) : null}
          </div>
        ) : null}

        {step === 2 && validation ? (
          <div className="grid gap-4">
            <div className="rounded-lg border bg-muted/30 p-3">
              <p className="font-medium">
                Accepted {validation.accepted_count} rows, rejected {validation.rejected_count} rows.
              </p>
              {validation.warnings.length > 0 ? (
                <p className="text-sm text-muted-foreground">
                  {validation.warnings.join(" ")}
                </p>
              ) : null}
            </div>
            {validation.rejected_rows.length > 0 ? (
              <details className="rounded-lg border p-3">
                <summary className="cursor-pointer font-medium">Rejected rows</summary>
                <ul className="mt-2 grid gap-1 text-sm text-muted-foreground">
                  {validation.rejected_rows.map((row) => (
                    <li key={row.row_number}>
                      Row {row.row_number}: {row.reason}
                    </li>
                  ))}
                </ul>
              </details>
            ) : null}
            {validation.accepted_samples.length > 0 ? (
              <div className="overflow-x-auto rounded-lg border">
                <table className="w-full text-xs">
                  <thead className="bg-muted/50 text-left">
                    <tr>
                      <th className="p-2">Row</th>
                      <th className="p-2">Phone</th>
                      <th className="p-2">Merge fields preview</th>
                    </tr>
                  </thead>
                  <tbody>
                    {validation.accepted_samples.map((row) => (
                      <tr key={row.row_number} className="border-t">
                        <td className="p-2">{row.row_number}</td>
                        <td className="p-2">{row.masked_phone}</td>
                        <td className="p-2 font-mono">
                          {JSON.stringify(row.merge_fields)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : null}
          </div>
        ) : null}

        {step === 3 && validation ? (
          <div className="rounded-lg border bg-muted/30 p-4">
            <p className="text-base font-medium">
              Add {validation.accepted_count} tasks to campaign {campaignName}?
            </p>
            <p className="text-sm text-muted-foreground">
              They&apos;ll start as queued and begin calling when you start the campaign.
            </p>
          </div>
        ) : null}

        <DialogFooter>
          {step > 1 ? (
            <Button
              type="button"
              variant="outline"
              disabled={pending || uploading}
              onClick={() => setStep((current) => (current === 3 ? 2 : 1))}
            >
              Back
            </Button>
          ) : null}
          {step === 1 ? (
            <Button type="button" disabled={!fileText || !phoneColumn || pending} onClick={validateCsv}>
              {pending ? "Validating..." : "Continue"}
            </Button>
          ) : null}
          {step === 2 && validation ? (
            <Button
              type="button"
              disabled={validation.accepted_count === 0}
              onClick={() => setStep(3)}
            >
              Continue
            </Button>
          ) : null}
          {step === 3 && validation ? (
            <Button type="button" disabled={uploading} onClick={uploadCsv}>
              {uploading ? "Uploading..." : `Upload ${validation.accepted_count} tasks`}
            </Button>
          ) : null}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
