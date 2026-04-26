"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import {
  createLeadFromCall,
  relinkCallFromDetail,
  rerunExtraction,
} from "@/app/dashboard/calls/actions";
import type {
  CallEvent,
  CallRow,
  RelatedLead,
} from "@/app/dashboard/calls/types";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { maskPhone } from "@/lib/phone";
import { cn } from "@/lib/utils";

function getExtractionObject(extraction: unknown): Record<string, unknown> {
  return extraction && typeof extraction === "object" && !Array.isArray(extraction)
    ? { ...extraction }
    : {};
}

function getSummary(extraction: unknown) {
  const obj = getExtractionObject(extraction);
  return typeof obj.summary === "string" ? obj.summary : "No summary available.";
}

function getRedFlags(extraction: unknown) {
  const obj = getExtractionObject(extraction);
  return Array.isArray(obj.red_flags)
    ? obj.red_flags.filter((item): item is string => typeof item === "string")
    : [];
}

function isDisplayValue(value: unknown) {
  return (
    value !== null &&
    value !== undefined &&
    (typeof value !== "object" ||
      (Array.isArray(value) &&
        value.some((item) => ["string", "number", "boolean"].includes(typeof item))))
  );
}

function flattenExtractionFields(
  extraction: Record<string, unknown>,
  keyPrefix = ""
): Array<[string, unknown]> {
  return Object.entries(extraction).flatMap(([key, value]) => {
    const fieldKey = keyPrefix ? `${keyPrefix}.${key}` : key;
    if (["summary", "red_flags", "transcript"].includes(key)) {
      return [];
    }

    if (isDisplayValue(value)) {
      return [[fieldKey, value]];
    }

    if (value && typeof value === "object" && !Array.isArray(value)) {
      return flattenExtractionFields(value as Record<string, unknown>, fieldKey);
    }

    return [];
  });
}

function formatExtractionValue(value: unknown) {
  if (Array.isArray(value)) {
    return value.join(", ");
  }

  return String(value);
}

function getKeyFields(extraction: unknown) {
  const obj = getExtractionObject(extraction);
  return flattenExtractionFields(obj);
}

function parseTranscript(transcript: string | null) {
  if (!transcript) {
    return [];
  }

  return transcript
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const match = line.match(/^([^:]{1,40}):\s*(.*)$/);
      return {
        speaker: match?.[1] ?? "Speaker",
        text: match?.[2] ?? line,
      };
    });
}

export function PhoneReveal({ phone }: { phone: string | null }) {
  const [shown, setShown] = useState(false);

  if (!phone) {
    return <span>Unknown</span>;
  }

  return (
    <span className="inline-flex items-center gap-2">
      {shown ? phone : maskPhone(phone)}
      <button
        type="button"
        className="text-xs underline"
        onClick={() => setShown((value) => !value)}
      >
        {shown ? "Hide" : "Show"}
      </button>
    </span>
  );
}

export function TranscriptView({ transcript }: { transcript: string | null }) {
  const rows = parseTranscript(transcript);

  if (!rows.length) {
    return <p className="text-sm text-muted-foreground">No transcript available.</p>;
  }

  return (
    <div className="grid max-h-[52rem] gap-3 overflow-auto rounded-xl border border-border-default bg-bg-surface-sunken p-4">
      {rows.map((row, index) => {
        const agent = /agent|assistant|ai/i.test(row.speaker);

        return (
          <div
            key={`${row.speaker}-${index}`}
            className={cn("flex", agent ? "justify-start" : "justify-end")}
          >
            <div
              className={cn(
                "max-w-[82%] rounded-2xl px-4 py-2 text-sm shadow-xs",
                agent
                  ? "rounded-tl-md bg-bg-emphasis text-fg-on-emphasis"
                  : "rounded-tr-md border border-border-subtle bg-bg-surface text-fg-primary"
              )}
            >
              <p className="mb-1 text-xs opacity-75">{agent ? "AI receptionist" : row.speaker}</p>
              <p className="leading-relaxed">{row.text}</p>
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function ExtractionPanel({
  call,
  relatedLeads,
  canRerun,
}: {
  call: CallRow;
  relatedLeads: RelatedLead[];
  canRerun: boolean;
}) {
  const router = useRouter();
  const [targetLeadId, setTargetLeadId] = useState("");
  const [pending, startTransition] = useTransition();
  const redFlags = getRedFlags(call.extraction);
  const keyFields = getKeyFields(call.extraction);

  function relink() {
    startTransition(async () => {
      const result = await relinkCallFromDetail({
        callId: call.id,
        targetLeadId,
      });
      if (result.ok) {
        toast.success(result.message);
        router.refresh();
      } else {
        toast.error(result.message);
      }
    });
  }

  function rerun() {
    startTransition(async () => {
      const result = await rerunExtraction(call.id);
      if (result.ok) {
        toast.success(result.message);
        router.refresh();
      } else {
        toast.error(result.message);
      }
    });
  }

  function createNewLead() {
    startTransition(async () => {
      const result = await createLeadFromCall(call.id);
      if (result.ok) {
        toast.success(result.message);
        if (result.leadId) {
          router.push(`/dashboard/leads/${result.leadId}`);
        } else {
          router.refresh();
        }
      } else {
        toast.error(result.message);
      }
    });
  }

  return (
    <div className="grid gap-4">
      <Card elevation="raised" padding="compact">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="font-heading text-lg font-semibold">Extraction fact sheet</h2>
            <p className="mt-1 text-sm text-fg-secondary">{getSummary(call.extraction)}</p>
          </div>
          <Badge variant={call.extraction_confidence === "high" ? "success" : call.extraction_confidence === "low" ? "danger" : "warning"}>
            {call.extraction_confidence ?? "pending"} confidence
          </Badge>
        </div>
      </Card>
      {redFlags.length ? (
        <Alert className="border-danger-border bg-danger-bg">
          <div className="grid gap-1">
            <p className="font-medium text-danger-fg">Red flags</p>
            {redFlags.map((flag) => (
              <p key={flag} className="text-sm">
                {flag}
              </p>
            ))}
          </div>
        </Alert>
      ) : null}
      <Card padding="compact">
        <h2 className="mb-3 text-sm font-semibold">Key fields</h2>
        <dl className="grid gap-2">
          {keyFields.map(([key, value]) => (
            <div key={key} className="grid grid-cols-[9rem_1fr] gap-3 rounded-lg border border-border-subtle bg-bg-surface-sunken px-3 py-2 text-sm">
              <dt className="text-fg-tertiary">{key.replaceAll("_", " ")}</dt>
              <dd className="font-medium">{formatExtractionValue(value)}</dd>
            </div>
          ))}
          {!keyFields.length ? (
            <p className="text-sm text-fg-tertiary">No structured fields extracted yet.</p>
          ) : null}
        </dl>
      </Card>
      <Card padding="compact">
        <h2 className="mb-3 text-sm font-semibold">Linked Lead</h2>
        {call.lead_id ? (
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="font-medium">{call.leads?.lead_type ?? "Lead"}</p>
              <p className="text-sm text-muted-foreground">
                {call.leads?.lead_status ?? "Linked"}
              </p>
            </div>
            <Button
              variant="secondary"
              render={<Link href={`/dashboard/leads/${call.lead_id}`} />}
            >
              Open lead
            </Button>
          </div>
        ) : (
          <p className="text-sm text-fg-tertiary">This call is unlinked.</p>
        )}
      </Card>
      <Card elevation="raised" padding="compact" className="gap-4 border-accent-secondary/30">
        <div>
          <h2 className="font-heading text-lg font-semibold">Use extracted facts</h2>
          <p className="mt-1 text-sm text-fg-secondary">
            Create a new lead from this extraction, or attach the call and extracted context to an existing lead.
          </p>
        </div>
        <div className="grid gap-3">
          <div className="grid gap-2">
            <label className="text-xs font-medium tracking-wide text-fg-tertiary uppercase">
              Existing lead
            </label>
            <select
              value={targetLeadId}
              className="h-10 w-full min-w-0 rounded-lg border border-border-default bg-bg-surface px-3 text-sm text-fg-primary"
              onChange={(event) => setTargetLeadId(event.target.value)}
            >
              <option value="">Choose existing lead</option>
              {relatedLeads.map((lead) => (
                <option key={lead.id} value={lead.id}>
                  {lead.lead_type.replaceAll("_", " ")} - {lead.lead_status} - {lead.id}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button disabled={pending} onClick={createNewLead}>
              Add as new lead
            </Button>
            <Button variant="secondary" disabled={pending || !targetLeadId} onClick={relink}>
              Add to existing lead
            </Button>
            <Button variant="tertiary" disabled={!canRerun || pending} onClick={rerun}>
              Re-extract facts
            </Button>
          </div>
        </div>
      </Card>
      {call.lead_id ? (
        <Button
          className="w-fit"
          variant="secondary"
          render={<Link href={`/dashboard/leads/${call.lead_id}`} />}
        >
          Open linked lead
        </Button>
      ) : null}
      {!canRerun ? (
        <p className="text-xs text-fg-tertiary">
          Only admins and owners can re-run extraction.
        </p>
      ) : null}
    </div>
  );
}

export function AuditTrail({ events }: { events: CallEvent[] }) {
  return (
    <Card className="p-4">
      <h2 className="mb-4 text-sm font-semibold">Audit Trail</h2>
      <div className="grid gap-3">
        {events.map((event) => (
          <div key={event.id} className="rounded-lg border p-3">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="outline">{event.event_type}</Badge>
              <span className="text-xs text-muted-foreground">
                {event.created_at
                  ? new Intl.DateTimeFormat("en-US", {
                      dateStyle: "short",
                      timeStyle: "short",
                    }).format(new Date(event.created_at))
                  : "Unknown time"}
              </span>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              {event.profiles?.full_name || event.profiles?.email || "System"}
            </p>
          </div>
        ))}
        {!events.length ? (
          <p className="text-sm text-muted-foreground">No audit events yet.</p>
        ) : null}
      </div>
    </Card>
  );
}
