"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import {
  addFlag,
  updateLeadField,
  updateLeadStatus,
} from "@/app/dashboard/leads/[id]/actions";
import {
  statusLabels,
  statusTransitions,
  urgencyOptions,
} from "@/app/dashboard/leads/[id]/lead-config";
import type { Activity, Lead, ProfileOption } from "@/app/dashboard/leads/[id]/types";
import { AutoSaveField, AutoSaveSelect, type FieldValue } from "@/app/dashboard/leads/[id]/field-components";
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

function formatDate(value: string | null) {
  return value ? new Intl.DateTimeFormat("en-US").format(new Date(value)) : "Not set";
}

export function LeadSummaryPane({
  lead,
  staff,
  flags,
}: {
  lead: Lead;
  staff: ProfileOption[];
  flags: Activity[];
}) {
  const [statusDialog, setStatusDialog] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [flag, setFlag] = useState("");
  const [pending, startTransition] = useTransition();
  const nextStatuses = statusTransitions[lead.lead_status];

  async function saveLeadField(field: string, value: FieldValue) {
    return updateLeadField({ leadId: lead.id, field, value });
  }

  function submitStatus(status: string) {
    startTransition(async () => {
      const result = await updateLeadStatus({ leadId: lead.id, status, note });
      if (result.ok) {
        toast.success(result.message);
        setStatusDialog(null);
        setNote("");
      } else {
        toast.error(result.message);
      }
    });
  }

  function submitFlag() {
    startTransition(async () => {
      const result = await addFlag({ leadId: lead.id, label: flag });
      if (result.ok) {
        toast.success(result.message);
        setFlag("");
      } else {
        toast.error(result.message);
      }
    });
  }

  return (
    <aside className="grid gap-4">
      <section className="rounded-xl border bg-background p-4">
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <Badge variant="outline">{lead.lead_type.replaceAll("_", " ")}</Badge>
          <Badge>{statusLabels[lead.lead_status]}</Badge>
          {lead.urgency ? <Badge variant="destructive">{lead.urgency}</Badge> : null}
        </div>
        <dl className="grid gap-2 text-sm">
          <div>
            <dt className="text-muted-foreground">Lead ID</dt>
            <dd className="break-all font-mono text-xs">{lead.id}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Created</dt>
            <dd>{formatDate(lead.created_at)}</dd>
          </div>
        </dl>
      </section>

      <section className="rounded-xl border bg-background p-4">
        <h2 className="mb-3 text-sm font-semibold">Status Actions</h2>
        <div className="flex flex-wrap gap-2">
          {nextStatuses.map((status) => (
            <Dialog
              key={status}
              open={statusDialog === status}
              onOpenChange={(open) => setStatusDialog(open ? status : null)}
            >
              <DialogTrigger render={<Button size="sm" variant="outline" />}>
                {statusLabels[status]}
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Move to {statusLabels[status]}</DialogTitle>
                  <DialogDescription>Add an optional note for the timeline.</DialogDescription>
                </DialogHeader>
                <Input
                  value={note}
                  placeholder="Optional note"
                  onChange={(event) => setNote(event.target.value)}
                />
                <DialogFooter>
                  <Button disabled={pending} onClick={() => submitStatus(status)}>
                    Update status
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          ))}
        </div>
      </section>

      <section className="grid gap-4 rounded-xl border bg-background p-4">
        <AutoSaveSelect
          field="assigned_to"
          label="Assigned to"
          value={lead.assigned_to}
          options={staff.map((member) => [
            member.id,
            member.full_name ?? member.email,
          ])}
          onSave={saveLeadField}
        />
        <AutoSaveField
          field="next_followup_at"
          label="Next follow-up"
          type="date"
          value={lead.next_followup_at?.slice(0, 10) ?? ""}
          onSave={saveLeadField}
        />
        <AutoSaveSelect
          field="urgency"
          label="Urgency"
          value={lead.urgency}
          options={urgencyOptions.map((item) => [item, item])}
          onSave={saveLeadField}
        />
      </section>

      <section className="grid gap-3 rounded-xl border bg-background p-4">
        <h2 className="text-sm font-semibold">Tags / Flags</h2>
        <div className="flex flex-wrap gap-2">
          {flags.length ? (
            flags.map((item) => (
              <Badge key={item.id} variant="destructive">
                {item.summary}
              </Badge>
            ))
          ) : (
            <p className="text-sm text-muted-foreground">No red flags yet.</p>
          )}
        </div>
        <div className="flex gap-2">
          <Input
            value={flag}
            placeholder="Add manual flag"
            onChange={(event) => setFlag(event.target.value)}
          />
          <Button type="button" variant="outline" disabled={pending} onClick={submitFlag}>
            Add
          </Button>
        </div>
      </section>

      <section className="grid gap-4 rounded-xl border bg-background p-4">
        <AutoSaveField
          field="source"
          label="Source"
          value={lead.source}
          onSave={saveLeadField}
        />
        <AutoSaveField
          field="referral_partner_name"
          label="Referral partner"
          value={lead.referral_partner_name}
          onSave={saveLeadField}
        />
      </section>
    </aside>
  );
}
