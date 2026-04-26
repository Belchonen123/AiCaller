"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { ChevronDownIcon, RefreshCcwIcon } from "lucide-react";
import { relinkCall } from "@/app/dashboard/leads/[id]/actions";
import type { IntakeCall, Lead } from "@/app/dashboard/leads/[id]/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

function formatDate(value: string | null) {
  return value ? new Intl.DateTimeFormat("en-US", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(value)) : "Unknown date";
}

function getSummary(extraction: unknown) {
  if (
    extraction &&
    typeof extraction === "object" &&
    "summary" in extraction &&
    typeof extraction.summary === "string"
  ) {
    return extraction.summary;
  }

  return "No summary available.";
}

function transcriptLines(transcript: string | null) {
  return (transcript || "No transcript available.")
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean);
}

export function CallHistoryTab({
  leadId,
  calls,
  relatedLeads,
}: {
  leadId: string;
  calls: IntakeCall[];
  relatedLeads: Pick<Lead, "id" | "lead_type" | "lead_status" | "created_at">[];
}) {
  const [expanded, setExpanded] = useState<string | null>(null);

  if (!calls.length) {
    return (
      <div className="rounded-xl border bg-background p-4 text-sm text-muted-foreground">
        No linked calls yet.
      </div>
    );
  }

  return (
    <div className="grid gap-3">
      {calls.map((call) => (
        <section key={call.id} className="rounded-xl border border-border-default bg-bg-surface p-4">
          <button
            type="button"
            className="grid w-full gap-2 text-left"
            onClick={() => setExpanded(expanded === call.id ? null : call.id)}
          >
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-medium">{formatDate(call.call_started_at)}</span>
              <Badge variant="neutral">{call.duration_seconds ?? 0}s</Badge>
              {call.extraction_confidence ? (
                <Badge variant="success">Confidence {call.extraction_confidence}</Badge>
              ) : null}
              <ChevronDownIcon className="ml-auto size-4 text-fg-tertiary" />
            </div>
            <p className="text-sm text-fg-secondary">{getSummary(call.extraction)}</p>
          </button>

          {expanded === call.id ? (
            <div className="mt-4 grid gap-4 border-t border-border-subtle pt-4 lg:grid-cols-[minmax(0,1fr)_18rem]">
              <div className="grid gap-4">
                {call.recording_url ? (
                  <details className="rounded-lg border border-border-default p-3" open>
                    <summary className="cursor-pointer text-sm font-medium">Audio</summary>
                    <audio controls src={call.recording_url} className="mt-3 w-full" />
                  </details>
                ) : null}
                <details className="rounded-lg border border-border-default p-3" open>
                  <summary className="cursor-pointer text-sm font-medium">Transcript</summary>
                  <div className="mt-3 grid max-h-96 gap-2 overflow-auto">
                    {transcriptLines(call.transcript).map((line, index) => {
                      const ai = /^ai|assistant|agent/i.test(line);
                      return (
                        <p
                          key={`${call.id}-${index}`}
                          className={`max-w-[85%] rounded-lg px-3 py-2 text-xs ${ai ? "bg-[var(--brand-navy-100)] text-fg-primary" : "ml-auto bg-bg-muted text-fg-primary"}`}
                        >
                          {line}
                        </p>
                      );
                    })}
                  </div>
                </details>
              </div>
              <div className="grid content-start gap-3 rounded-lg border border-border-default bg-bg-surface-sunken p-3">
                <h3 className="text-sm font-semibold">Extraction summary</h3>
                <p className="text-sm text-fg-secondary">{getSummary(call.extraction)}</p>
                <details>
                  <summary className="cursor-pointer text-xs font-medium text-fg-tertiary">
                    Raw fields
                  </summary>
                  <pre className="mt-2 max-h-64 overflow-auto text-xs whitespace-pre-wrap">
                    {JSON.stringify(call.extraction, null, 2)}
                  </pre>
                </details>
                <Button variant="secondary" render={<Link href={`/dashboard/calls/${call.id}`} />}>
                  View full call
                </Button>
                <RelinkDialog leadId={leadId} callId={call.id} relatedLeads={relatedLeads} />
                <Button variant="secondary" disabled>
                  <RefreshCcwIcon />
                  Re-extract
                </Button>
              </div>
            </div>
          ) : null}
        </section>
      ))}
    </div>
  );
}

function RelinkDialog({
  leadId,
  callId,
  relatedLeads,
}: {
  leadId: string;
  callId: string;
  relatedLeads: Pick<Lead, "id" | "lead_type" | "lead_status" | "created_at">[];
}) {
  const [targetLeadId, setTargetLeadId] = useState("");
  const [pending, startTransition] = useTransition();

  function submit() {
    startTransition(async () => {
      const result = await relinkCall({ leadId, callId, targetLeadId });
      if (result.ok) {
        toast.success(result.message);
      } else {
        toast.error(result.message);
      }
    });
  }

  return (
    <Dialog>
      <DialogTrigger render={<Button variant="outline" />}>
        Relink to different lead
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Relink call</DialogTitle>
        </DialogHeader>
        <select
          value={targetLeadId}
          className="h-8 rounded-lg border bg-background px-2 text-sm"
          onChange={(event) => setTargetLeadId(event.target.value)}
        >
          <option value="">Choose lead</option>
          {relatedLeads
            .filter((lead) => lead.id !== leadId)
            .map((lead) => (
              <option key={lead.id} value={lead.id}>
                {lead.lead_type.replaceAll("_", " ")} - {lead.lead_status} - {lead.id}
              </option>
            ))}
        </select>
        <DialogFooter>
          <Button disabled={pending || !targetLeadId} onClick={submit}>
            Relink
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
