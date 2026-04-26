"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import {
  ArchiveIcon,
  CalendarClockIcon,
  ClipboardCopyIcon,
  DownloadIcon,
  FlagIcon,
  MoreHorizontalIcon,
  PrinterIcon,
} from "lucide-react";
import { ActivityTab } from "@/app/dashboard/leads/[id]/activity-tab";
import {
  addFlag,
  archiveLead,
  markIntakeComplete,
  updateLeadField,
  updateLeadStatus,
} from "@/app/dashboard/leads/[id]/actions";
import { CallHistoryTab } from "@/app/dashboard/leads/[id]/call-history-tab";
import { ContactsTab } from "@/app/dashboard/leads/[id]/contacts-tab";
import { IntakeTab } from "@/app/dashboard/leads/[id]/intake-tab";
import {
  adlFields,
  iadlFields,
  primaryPayers,
  statusLabels,
  statusTransitions,
  urgencyOptions,
} from "@/app/dashboard/leads/[id]/lead-config";
import { NotesTab } from "@/app/dashboard/leads/[id]/notes-tab";
import { buildPlainTextSummary } from "@/app/dashboard/leads/[id]/summary";
import type { DetailRecord, LeadDetailData } from "@/app/dashboard/leads/[id]/types";
import { AutoSaveField, AutoSaveSelect, type FieldValue } from "@/app/dashboard/leads/[id]/field-components";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";

const tabs = ["Intake", "Contacts", "Calls", "Activity", "Notes", "Documents"] as const;

export function LeadDetailClient({ data }: { data: LeadDetailData }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [actionsOpen, setActionsOpen] = useState(false);
  const [followupOpen, setFollowupOpen] = useState(false);
  const [followupDate, setFollowupDate] = useState("");
  const primaryContact =
    data.contacts.find((contact) => contact.is_primary_contact) ??
    data.contacts[0] ??
    null;
  const chartName = getClientName(data);

  function run(action: () => Promise<{ ok: boolean; message: string }>) {
    startTransition(async () => {
      const result = await action();
      if (result.ok) toast.success(result.message);
      else toast.error(result.message);
    });
  }

  function runAction(action: () => Promise<{ ok: boolean; message: string }>) {
    setActionsOpen(false);
    run(action);
  }

  function saveFollowup() {
    if (!followupDate) {
      toast.error("Choose a follow-up date.");
      return;
    }

    startTransition(async () => {
      const result = await updateLeadField({
        leadId: data.lead.id,
        field: "next_followup_at",
        value: followupDate,
      });
      if (result.ok) {
        toast.success(result.message);
        setFollowupOpen(false);
        setFollowupDate("");
        router.refresh();
      } else {
        toast.error(result.message);
      }
    });
  }

  return (
    <div className="grid gap-4">
      <section className="sticky top-14 z-20 rounded-xl border border-border-default bg-bg-surface/95 p-4 shadow-sm backdrop-blur-md">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
          <div className="flex min-w-0 gap-4">
            <Avatar size="lg">
              <AvatarFallback>{initials(chartName)}</AvatarFallback>
            </Avatar>
            <div className="min-w-0">
              <nav className="mb-1 text-sm text-fg-tertiary">
                <Link href="/dashboard/leads" className="hover:text-fg-link">
                  Leads
                </Link>{" "}
                / <span className="text-fg-secondary">{chartName}</span>
              </nav>
              <h1 className="font-heading text-xl font-semibold tracking-snug text-fg-primary">
                {chartName}
              </h1>
              <p className="mt-1 text-sm text-fg-secondary">
                {subtitle(data.prospectiveClient)} · ID {data.lead.id.slice(0, 8).toUpperCase()}
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <Badge variant="brand">{statusLabels[data.lead.lead_status]}</Badge>
                <Badge variant="neutral">{data.lead.lead_type.replaceAll("_", " ")}</Badge>
                {data.lead.urgency ? (
                  <Badge variant={urgencyVariant(data.lead.urgency)} dot>
                    {data.lead.urgency}
                  </Badge>
                ) : null}
                <Badge variant="info">{payerLabel(data.prospectiveClient)}</Badge>
              </div>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Popover open={actionsOpen} onOpenChange={setActionsOpen}>
              <PopoverTrigger render={<Button variant="secondary" />}>
                <MoreHorizontalIcon />
                Actions
              </PopoverTrigger>
              <PopoverContent align="end" className="w-72">
                <PopoverHeader>
                  <PopoverTitle>Status transitions</PopoverTitle>
                </PopoverHeader>
                {statusTransitions[data.lead.lead_status].map((status) => (
                  <Button
                    key={status}
                    type="button"
                    variant="tertiary"
                    className="justify-start"
                    disabled={pending}
                    onClick={() => runAction(() => updateLeadStatus({ leadId: data.lead.id, status }))}
                  >
                    Move to {statusLabels[status]}
                  </Button>
                ))}
                <div className="my-1 h-px bg-border-subtle" />
                <Button
                  type="button"
                  variant="tertiary"
                  className="justify-start"
                  disabled={pending}
                  onClick={() =>
                    runAction(() =>
                      updateLeadField({
                        leadId: data.lead.id,
                        field: "assigned_to",
                        value: data.staff[0]?.id ?? null,
                      })
                    )
                  }
                >
                  Assign
                </Button>
                <Button
                  type="button"
                  variant="tertiary"
                  className="justify-start"
                  disabled={pending}
                  onClick={() => {
                    setActionsOpen(false);
                    setFollowupOpen(true);
                  }}
                >
                  <CalendarClockIcon />
                  Schedule follow-up
                </Button>
                <Button
                  type="button"
                  variant="tertiary"
                  className="justify-start"
                  disabled={pending}
                  onClick={() =>
                    runAction(() => addFlag({ leadId: data.lead.id, label: "Manual review flag" }))
                  }
                >
                  <FlagIcon />
                  Flag
                </Button>
                <Button
                  type="button"
                  variant="tertiary"
                  className="justify-start"
                  disabled={pending}
                  onClick={() => {
                    setActionsOpen(false);
                    window.open(`/dashboard/leads/${data.lead.id}/print`, "_blank");
                  }}
                >
                  <PrinterIcon />
                  Print
                </Button>
                <Button
                  type="button"
                  variant="destructive"
                  className="justify-start"
                  disabled={pending}
                  onClick={() => runAction(() => archiveLead({ leadId: data.lead.id }))}
                >
                  <ArchiveIcon />
                  Archive
                </Button>
              </PopoverContent>
            </Popover>
            <Button
              disabled={pending}
              onClick={() => run(() => markIntakeComplete({ leadId: data.lead.id }))}
            >
              Mark intake complete
            </Button>
            <Dialog open={followupOpen} onOpenChange={setFollowupOpen}>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Schedule follow-up</DialogTitle>
                </DialogHeader>
                <Input
                  type="date"
                  value={followupDate}
                  onChange={(event) => setFollowupDate(event.target.value)}
                />
                <DialogFooter showCloseButton>
                  <Button disabled={pending || !followupDate} onClick={saveFollowup}>
                    Save follow-up
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </div>
      </section>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,70%)_minmax(22rem,30%)]">
        <Tabs defaultValue="Intake" className="min-w-0">
          <TabsList variant="line" className="w-full justify-start overflow-x-auto">
            {tabs.map((tab) => (
              <TabsTrigger key={tab} value={tab}>
                {tab}
              </TabsTrigger>
            ))}
          </TabsList>
          <TabsContent value="Intake">
            <IntakeTab
              lead={data.lead}
              prospectiveClient={data.prospectiveClient}
              caregiverApplicant={data.caregiverApplicant}
            />
          </TabsContent>
          <TabsContent value="Contacts">
            <ContactsTab leadId={data.lead.id} contacts={data.contacts} />
          </TabsContent>
          <TabsContent value="Calls">
            <CallHistoryTab
              leadId={data.lead.id}
              calls={data.calls}
              relatedLeads={data.relatedLeads}
            />
          </TabsContent>
          <TabsContent value="Activity">
            <ActivityTab leadId={data.lead.id} activities={data.activities} />
          </TabsContent>
          <TabsContent value="Notes">
            <NotesTab
              lead={data.lead}
              noteActivities={data.activities.filter(
                (activity) => activity.activity_type === "note"
              )}
            />
          </TabsContent>
          <TabsContent value="Documents">
            <Card padding="comfortable" className="items-center text-center">
              <h2 className="text-lg font-semibold">Documents coming in v2</h2>
              <p className="text-sm text-fg-secondary">
                Intake packets, authorizations, and uploaded documents will live here.
              </p>
            </Card>
          </TabsContent>
        </Tabs>

        <ChartSidebar
          data={data}
          primaryContact={primaryContact}
          onRun={run}
          pending={pending}
        />
      </div>
    </div>
  );
}

function ChartSidebar({
  data,
  primaryContact,
  onRun,
  pending,
}: {
  data: LeadDetailData;
  primaryContact: LeadDetailData["contacts"][number] | null;
  onRun: (action: () => Promise<{ ok: boolean; message: string }>) => void;
  pending: boolean;
}) {
  async function saveLeadField(field: string, value: FieldValue) {
    return updateLeadField({ leadId: data.lead.id, field, value });
  }

  async function copySummary() {
    await navigator.clipboard.writeText(
      buildPlainTextSummary({
        lead: data.lead,
        primaryContact,
        prospectiveClient: data.prospectiveClient,
        caregiverApplicant: data.caregiverApplicant,
      })
    );
    toast.success("Summary copied.");
  }

  return (
    <aside className="grid gap-4 xl:sticky xl:top-32 xl:self-start">
      <Card padding="compact">
        <CardTitle title="Snapshot" />
        <div className="grid gap-3">
          <AutoSaveSelect
            field="assigned_to"
            label="Assigned to"
            value={data.lead.assigned_to}
            options={data.staff.map((member) => [member.id, member.full_name ?? member.email])}
            onSave={saveLeadField}
          />
          <AutoSaveSelect
            field="urgency"
            label="Urgency"
            value={data.lead.urgency}
            options={urgencyOptions.map((item) => [item, item])}
            onSave={saveLeadField}
          />
          <AutoSaveField
            key={`next-followup-${data.lead.next_followup_at ?? "empty"}`}
            field="next_followup_at"
            label="Next follow-up"
            type="date"
            value={data.lead.next_followup_at?.slice(0, 10) ?? ""}
            onSave={saveLeadField}
          />
        </div>
      </Card>

      <Card padding="compact">
        <CardTitle title="Health summary" />
        <AdlBurden record={data.prospectiveClient} />
        <dl className="grid gap-2 text-sm">
          <Fact label="IADL summary" value={`${countAssists(data.prospectiveClient, iadlFields)} of 6 need support`} />
          <Fact label="Cognitive status" value={text(data.prospectiveClient, "cognitive_status")} />
          <Fact label="Mobility" value={text(data.prospectiveClient, "mobility_status")} />
        </dl>
      </Card>

      <Card padding="compact">
        <CardTitle title="Coverage" />
        <div className="flex items-center gap-2 text-sm">
          <span className={cn("size-2 rounded-full", coverageDot(data.prospectiveClient))} />
          <span>{payerLabel(data.prospectiveClient)}</span>
        </div>
        <dl className="mt-2 grid gap-2 text-sm">
          <Fact label="Plan" value={text(data.prospectiveClient, "mco_plan_name")} />
          <Fact label="Medicaid" value={coverageStatus(data.prospectiveClient)} />
        </dl>
      </Card>

      <Card padding="compact">
        <CardTitle title="Recent activity" />
        <div className="max-h-52 overflow-y-auto">
          {data.activities.slice(0, 5).map((activity) => (
            <div key={activity.id} className="border-b border-border-subtle py-2 last:border-b-0">
              <p className="text-sm font-medium">{activity.summary}</p>
              <p className="text-xs text-fg-tertiary">{formatDateTime(activity.created_at)}</p>
            </div>
          ))}
        </div>
        <a href="#activity" className="text-sm text-fg-link underline-offset-4 hover:underline">
          View full Activity tab
        </a>
      </Card>

      <Card padding="compact">
        <CardTitle title="Export & handoff" />
        <Button variant="secondary" render={<a href={`/dashboard/leads/${data.lead.id}/export`} />}>
          <DownloadIcon />
          Export CSV
        </Button>
        <Button variant="secondary" onClick={() => window.open(`/dashboard/leads/${data.lead.id}/print`, "_blank")}>
          <PrinterIcon />
          Print intake packet
        </Button>
        <Button variant="secondary" onClick={copySummary}>
          <ClipboardCopyIcon />
          Copy summary
        </Button>
        <Button
          variant="destructive"
          disabled={pending}
          onClick={() => onRun(() => archiveLead({ leadId: data.lead.id }))}
        >
          Archive lead
        </Button>
      </Card>
    </aside>
  );
}

function CardTitle({ title }: { title: string }) {
  return <h2 className="text-sm font-semibold tracking-wide text-fg-primary">{title}</h2>;
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-3">
      <dt className="text-fg-tertiary">{label}</dt>
      <dd className="text-right font-medium text-fg-primary">{value || "Not assessed"}</dd>
    </div>
  );
}

function AdlBurden({ record }: { record: DetailRecord | null }) {
  const count = countAssists(record, adlFields);
  return (
    <div>
      <div className="mb-2 flex items-center justify-between text-sm">
        <span className="text-fg-tertiary">ADL burden</span>
        <span className="font-medium">{count} / 6</span>
      </div>
      <div className="flex gap-1">
        {Array.from({ length: 6 }).map((_, index) => (
          <span
            key={index}
            className={cn("h-2 flex-1 rounded-full bg-bg-muted", index < count && "bg-accent-primary")}
          />
        ))}
      </div>
    </div>
  );
}

function getClientName(data: LeadDetailData) {
  const record =
    data.lead.lead_type === "caregiver_applicant"
      ? data.caregiverApplicant
      : data.prospectiveClient;
  const first = text(record, "first_name");
  const last = text(record, "last_name");
  return [first, last].filter(Boolean).join(" ") || data.contacts[0]?.full_name || "Unnamed lead";
}

function initials(value: string) {
  return value
    .split(/\s+/)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

function subtitle(record: DetailRecord | null) {
  const dob = text(record, "date_of_birth") || "DOB not captured";
  const age = text(record, "age") || "age unknown";
  const city = text(record, "address_city") || "city unknown";
  return `${dob} · ${age} · ${city}`;
}

function text(record: DetailRecord | null, field: string) {
  const value = record?.[field];
  return typeof value === "string" || typeof value === "number"
    ? String(value).replaceAll("_", " ")
    : "";
}

function payerLabel(record: DetailRecord | null) {
  const payer = text(record, "primary_payer");
  const match = primaryPayers.find(([value]) => value === payer);
  return match?.[1] ?? (payer || "Payer not captured");
}

function countAssists(record: DetailRecord | null, fields: readonly (readonly [string, string])[]) {
  return fields.filter(([field]) => {
    const value = record?.[field];
    return value === "partial_assist" || value === "total_assist" || value === "needs_help";
  }).length;
}

function coverageStatus(record: DetailRecord | null) {
  if (record?.medicaid_active === true) return "Active";
  if (record?.medicaid_pending === true) return "Pending";
  return "Unknown";
}

function coverageDot(record: DetailRecord | null) {
  if (record?.medicaid_active === true) return "bg-success-fg";
  if (record?.medicaid_pending === true) return "bg-warning-fg";
  return "bg-fg-tertiary";
}

function urgencyVariant(value: string) {
  if (value === "emergent") return "emergent";
  if (value === "urgent") return "urgent";
  if (value === "routine") return "routine";
  return "informational";
}

function formatDateTime(value: string | null) {
  return value
    ? new Intl.DateTimeFormat("en-US", { dateStyle: "short", timeStyle: "short" }).format(
        new Date(value)
      )
    : "Unknown time";
}
