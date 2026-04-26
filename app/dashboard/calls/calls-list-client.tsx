"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  FileTextIcon,
  PhoneIncomingIcon,
  PhoneOffIcon,
  PhoneOutgoingIcon,
  UnlinkIcon,
} from "lucide-react";
import type { CallRow } from "@/app/dashboard/calls/types";
import { EmptyState } from "@/components/empty-state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatDate, formatDuration, formatRelativeTime, maskPhone } from "@/lib/formatters";

function extractionObject(extraction: unknown) {
  return extraction && typeof extraction === "object" && !Array.isArray(extraction)
    ? (extraction as Record<string, unknown>)
    : {};
}

function summary(call: CallRow) {
  const extraction = extractionObject(call.extraction);
  return typeof extraction.summary === "string" && extraction.summary.trim()
    ? extraction.summary
    : "No extraction summary yet.";
}

function linkedLead(call: CallRow) {
  return call.leads
    ? `${call.leads.lead_type.replaceAll("_", " ")} (${call.leads.lead_status})`
    : "Linked lead";
}

function confidenceVariant(confidence: string | null) {
  if (confidence === "high") return "success";
  if (confidence === "medium") return "warning";
  if (confidence === "low") return "danger";
  return "neutral";
}

export function CallsListClient({ calls }: { calls: CallRow[] }) {
  const [previewCall, setPreviewCall] = useState<CallRow | null>(null);
  const previewFields = useMemo(() => {
    const extraction = extractionObject(previewCall?.extraction);
    return Object.entries(extraction)
      .filter(([key, value]) => key !== "summary" && value !== null && value !== undefined)
      .slice(0, 8);
  }, [previewCall]);

  if (!calls.length) {
    return (
      <EmptyState
        icon={PhoneOffIcon}
        title="No calls yet — your AI receptionist is ready"
        description="Inbound and outbound calls will appear here with transcripts, confidence, and linked lead context."
      />
    );
  }

  return (
    <>
      <Table stickyHeader className="min-w-[980px]">
        <TableHeader>
          <TableRow>
            <TableHead>Direction</TableHead>
            <TableHead>When</TableHead>
            <TableHead>Duration</TableHead>
            <TableHead>Masked phone</TableHead>
            <TableHead>Linked lead</TableHead>
            <TableHead>Confidence</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {calls.map((call) => {
            const outbound = call.call_direction === "outbound";
            const DirectionIcon = outbound ? PhoneOutgoingIcon : PhoneIncomingIcon;
            return (
              <TableRow
                key={call.id}
                className="cursor-pointer"
                onClick={() => setPreviewCall(call)}
              >
                <TableCell>
                  <span className="inline-flex items-center gap-2 capitalize">
                    <span className="grid size-8 place-items-center rounded-full bg-bg-emphasis text-accent-primary">
                      <DirectionIcon className="size-4" />
                    </span>
                    {call.call_direction ?? "inbound"}
                  </span>
                </TableCell>
                <TableCell>
                  <span title={formatDate(call.created_at)} className="font-medium">
                    {formatRelativeTime(call.created_at) || "Unknown"}
                  </span>
                  <span className="block text-xs text-fg-tertiary">{formatDate(call.created_at)}</span>
                </TableCell>
                <TableCell className="font-mono tabular-nums">
                  {formatDuration(call.duration_seconds)}
                </TableCell>
                <TableCell className="font-mono">
                  {call.caller_phone_normalized ? maskPhone(call.caller_phone_normalized) : "Unknown"}
                </TableCell>
                <TableCell>
                  {call.lead_id ? (
                    <Link
                      href={`/dashboard/leads/${call.lead_id}`}
                      className="font-medium text-fg-link hover:underline"
                      onClick={(event) => event.stopPropagation()}
                    >
                      {linkedLead(call)}
                    </Link>
                  ) : (
                    <div className="flex items-center gap-2">
                      <Badge variant="neutral">Unlinked</Badge>
                      <Button
                        variant="tertiary"
                        size="xs"
                        onClick={(event) => {
                          event.stopPropagation();
                          setPreviewCall(call);
                        }}
                      >
                        <UnlinkIcon />
                        Link
                      </Button>
                    </div>
                  )}
                </TableCell>
                <TableCell>
                  {call.extraction_confidence ? (
                    <Badge variant={confidenceVariant(call.extraction_confidence)}>
                      {call.extraction_confidence}
                    </Badge>
                  ) : (
                    <Badge variant="neutral">Pending</Badge>
                  )}
                </TableCell>
                <TableCell>
                  <Badge variant="neutral">{call.status}</Badge>
                </TableCell>
                <TableCell>
                  <Button
                    variant="secondary"
                    size="sm"
                    render={<Link href={`/dashboard/calls/${call.id}`} onClick={(event) => event.stopPropagation()} />}
                  >
                    View
                  </Button>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>

      <Sheet open={Boolean(previewCall)} onOpenChange={(open) => !open && setPreviewCall(null)}>
        <SheetContent className="max-w-xl">
          <SheetHeader>
            <SheetTitle>Call preview</SheetTitle>
            <SheetDescription>
              {previewCall ? `${formatDate(previewCall.created_at)} · ${formatDuration(previewCall.duration_seconds)}` : ""}
            </SheetDescription>
          </SheetHeader>
          {previewCall ? (
            <div className="grid gap-4 overflow-y-auto pr-1">
              <div className="rounded-xl border border-border-subtle bg-bg-surface-sunken p-4">
                <div className="mb-2 flex items-center gap-2 text-sm font-semibold">
                  <FileTextIcon className="size-4 text-accent-primary" />
                  Extraction summary
                </div>
                <p className="text-sm leading-normal text-fg-secondary">{summary(previewCall)}</p>
              </div>
              <div className="rounded-xl border border-border-subtle p-4">
                <p className="mb-2 text-sm font-semibold">Transcript</p>
                <p className="line-clamp-[12] whitespace-pre-wrap text-sm leading-relaxed text-fg-secondary">
                  {previewCall.transcript || "No transcript available yet."}
                </p>
              </div>
              <dl className="grid gap-2">
                {previewFields.map(([key, value]) => (
                  <div key={key} className="grid grid-cols-[9rem_1fr] gap-3 text-sm">
                    <dt className="text-fg-tertiary">{key.replaceAll("_", " ")}</dt>
                    <dd className="font-medium">{String(value)}</dd>
                  </div>
                ))}
              </dl>
            </div>
          ) : null}
          <SheetFooter>
            <Button disabled={!previewCall} render={<Link href={previewCall ? `/dashboard/calls/${previewCall.id}` : "#"} />}>
              Open full call
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </>
  );
}
