"use client";

import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { motion } from "framer-motion";
import {
  ArchiveIcon,
  CalendarClockIcon,
  CheckIcon,
  ClockIcon,
  Columns3Icon,
  DownloadIcon,
  MoreHorizontalIcon,
  PhoneIncomingIcon,
  SearchXIcon,
  UserPlusIcon,
} from "lucide-react";
import { toast } from "sonner";
import {
  archiveLead,
  assignLeadToMe,
  flagLead,
  markLeadContacted,
  scheduleFollowUp,
} from "@/app/dashboard/leads/actions";
import {
  leadTypeLabels,
  payerLabels,
  statusLabels,
} from "@/app/dashboard/leads/list-config";
import type { LeadFilters, LeadListItem } from "@/app/dashboard/leads/types";
import { EmptyState } from "@/components/empty-state";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import {
  Sheet,
  SheetContent,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Table,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { formatDate, formatPhone, formatRelativeTime } from "@/lib/formatters";
import { useActualizerMotion } from "@/lib/motion";
import { cn } from "@/lib/utils";

type Density = "comfortable" | "compact";
type ColumnKey =
  | "status"
  | "leadType"
  | "client"
  | "contact"
  | "adl"
  | "urgency"
  | "lastContact"
  | "nextFollowup"
  | "assigned"
  | "calls"
  | "actions";

type LeadListClientProps = {
  items: LeadListItem[];
  filters: LeadFilters;
  rawSearchParams: Record<string, string | string[] | undefined>;
  totalFiltered: number;
  totalPages: number;
  hasAnyLeads: boolean;
};

const defaultColumns: Record<ColumnKey, boolean> = {
  status: true,
  leadType: true,
  client: true,
  contact: true,
  adl: true,
  urgency: true,
  lastContact: true,
  nextFollowup: true,
  assigned: true,
  calls: true,
  actions: true,
};

const columnLabels: Record<ColumnKey, string> = {
  status: "Status",
  leadType: "Lead type",
  client: "Client",
  contact: "Primary contact",
  adl: "ADL burden",
  urgency: "Urgency",
  lastContact: "Last contact",
  nextFollowup: "Next follow-up",
  assigned: "Assigned",
  calls: "Calls",
  actions: "Actions",
};

const adlFields = [
  ["adl_bathing", "Bathing"],
  ["adl_dressing", "Dressing"],
  ["adl_grooming", "Grooming"],
  ["adl_toileting", "Toileting"],
  ["adl_transferring", "Transferring"],
  ["adl_eating", "Eating"],
] as const;

function clientName(item: LeadListItem) {
  const first = item.prospectiveClient?.first_name;
  const last = item.prospectiveClient?.last_name;
  return [first, last].filter(Boolean).join(" ") || item.primaryContact?.full_name || "TBD";
}

function initials(name: string | null | undefined, email?: string | null) {
  const source = name || email || "U";
  return source
    .split(/\s+/)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

function isOverdue(value: string | null) {
  if (!value) return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return new Date(value) < today;
}

function isToday(value: string | null) {
  if (!value) return false;
  return new Date(value).toDateString() === new Date().toDateString();
}

function adlBurden(item: LeadListItem) {
  const client = item.prospectiveClient;
  if (!client) return 0;
  return adlFields.filter(([field]) => {
    const value = client[field];
    return value === "partial_assist" || value === "total_assist";
  }).length;
}

function adlSummary(item: LeadListItem) {
  const client = item.prospectiveClient;
  if (!client) return "No ADL details captured.";
  return adlFields
    .map(([field, label]) => `${label}: ${String(client[field] ?? "not discussed").replaceAll("_", " ")}`)
    .join(" · ");
}

function urgencyVariant(value: string | null) {
  if (value === "emergent") return "emergent";
  if (value === "urgent") return "urgent";
  if (value === "routine") return "routine";
  return "informational";
}

function statusVariant(item: LeadListItem) {
  if (item.flagged || item.urgency === "emergent" || item.urgency === "urgent") return "danger";
  if (item.lead_status === "enrolled" || item.lead_status === "authorized") return "success";
  if (item.lead_status === "lost" || item.lead_status === "disqualified") return "neutral";
  return "brand";
}

export function LeadListClient({
  items,
  filters,
  rawSearchParams,
  totalFiltered,
  totalPages,
  hasAnyLeads,
}: LeadListClientProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [selected, setSelected] = useState<string[]>([]);
  const [density, setDensity] = useState<Density>("comfortable");
  const [columns, setColumns] = useState(defaultColumns);
  const [previewLead, setPreviewLead] = useState<LeadListItem | null>(null);
  const [scheduleLead, setScheduleLead] = useState<string | null>(null);
  const [followupDate, setFollowupDate] = useState("");
  const motionVariants = useActualizerMotion();
  const [pending, startTransition] = useTransition();

  const selectedSet = useMemo(() => new Set(selected), [selected]);
  const allVisibleSelected = items.length > 0 && items.every((item) => selectedSet.has(item.id));
  const first = totalFiltered === 0 ? 0 : (filters.page - 1) * filters.pageSize + 1;
  const last = Math.min(filters.page * filters.pageSize, totalFiltered);

  function run(action: () => Promise<{ ok: boolean; message: string }>) {
    startTransition(async () => {
      const result = await action();
      if (result.ok) {
        toast.success(result.message);
        router.refresh();
      } else {
        toast.error(result.message);
      }
    });
  }

  function archiveSelected() {
    const leadIds = [...selected];
    if (leadIds.length === 0) {
      return;
    }

    startTransition(async () => {
      const results = await Promise.all(leadIds.map((leadId) => archiveLead(leadId)));
      const failed = results.filter((result) => !result.ok);

      if (failed.length > 0) {
        toast.error(`Archived ${results.length - failed.length}; ${failed.length} failed.`);
        return;
      }

      toast.success(`Archived ${leadIds.length} leads.`);
      setSelected([]);
      router.refresh();
    });
  }

  function setPageParam(key: string, value: string) {
    const next = new URLSearchParams(searchParams.toString());
    if (value) next.set(key, value);
    else next.delete(key);
    if (key !== "page") next.delete("page");
    router.push(`${pathname}?${next.toString()}`);
  }

  function pageHref(page: number) {
    const next = new URLSearchParams(
      Object.entries(rawSearchParams).flatMap(([key, value]) =>
        Array.isArray(value) ? value.map((item) => [key, item]) : [[key, value ?? ""]]
      )
    );
    next.set("page", String(page));
    return `/dashboard/leads?${next.toString()}`;
  }

  function toggleSelected(id: string) {
    setSelected((current) =>
      current.includes(id) ? current.filter((item) => item !== id) : [...current, id]
    );
  }

  function openLead(id: string) {
    router.push(`/dashboard/leads/${id}`);
  }

  if (!items.length) {
    return (
      <div className="grid gap-4">
        <EmptyState
          icon={hasAnyLeads ? SearchXIcon : PhoneIncomingIcon}
          title={hasAnyLeads ? "No leads match your filters" : "Your AI receptionist is ready"}
          description={
            hasAnyLeads
              ? "Try clearing filters, widening the date range, or switching to all statuses."
              : "Calls to your Retell number will appear here as leads."
          }
          action={
            hasAnyLeads ? (
              <Button render={<Link href="/dashboard/leads" />}>Clear filters</Button>
            ) : (
              <Button render={<Link href="/dashboard/test-call" />}>Place a test call</Button>
            )
          }
        />
      </div>
    );
  }

  return (
    <div className="grid gap-3">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border-default bg-bg-surface px-3 py-2 shadow-xs">
        <div className="flex flex-wrap items-center gap-2">
          {selected.length ? (
            <>
              <Badge variant="brand">{selected.length} selected</Badge>
              <Button size="sm" variant="secondary" iconLeft={<UserPlusIcon />}>
                Assign
              </Button>
              <Button size="sm" variant="secondary">
                Status change
              </Button>
              <Button size="sm" variant="secondary" iconLeft={<DownloadIcon />}>
                Export selected
              </Button>
              <Button
                size="sm"
                variant="destructive"
                iconLeft={<ArchiveIcon />}
                disabled={pending}
                onClick={archiveSelected}
              >
                Archive
              </Button>
            </>
          ) : (
            <span className="text-sm text-fg-secondary">
              Dense lead queue optimized for intake follow-up.
            </span>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex h-8 rounded-md border border-border-default bg-bg-surface-sunken p-0.5">
            {(["comfortable", "compact"] as const).map((value) => (
              <button
                key={value}
                type="button"
                onClick={() => setDensity(value)}
                className={cn(
                  "rounded px-2 text-xs font-medium capitalize text-fg-secondary",
                  density === value && "bg-bg-surface text-fg-primary shadow-xs"
                )}
              >
                {value}
              </button>
            ))}
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger render={<Button variant="secondary" size="sm" />}>
              <Columns3Icon />
              Columns
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-52">
              <DropdownMenuLabel>Column visibility</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {(Object.keys(columnLabels) as ColumnKey[]).map((key) => (
                <DropdownMenuCheckboxItem
                  key={key}
                  checked={columns[key]}
                  onCheckedChange={(checked) =>
                    setColumns((current) => ({ ...current, [key]: checked }))
                  }
                >
                  {columnLabels[key]}
                </DropdownMenuCheckboxItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <Table stickyHeader zebra={density === "comfortable"} className="min-w-[1480px]">
        <TableHeader>
          <TableRow>
            <TableHead className="w-10">
              <input
                type="checkbox"
                checked={allVisibleSelected}
                onChange={(event) =>
                  setSelected(event.target.checked ? items.map((item) => item.id) : [])
                }
                aria-label="Select visible leads"
              />
            </TableHead>
            {columns.status ? <TableHead>Status</TableHead> : null}
            {columns.leadType ? <TableHead>Lead type</TableHead> : null}
            {columns.client ? <TableHead>Client</TableHead> : null}
            {columns.contact ? <TableHead>Primary contact</TableHead> : null}
            {columns.adl ? <TableHead>ADL burden</TableHead> : null}
            {columns.urgency ? <TableHead>Urgency</TableHead> : null}
            {columns.lastContact ? <TableHead>Last contact</TableHead> : null}
            {columns.nextFollowup ? <TableHead>Next follow-up</TableHead> : null}
            {columns.assigned ? <TableHead>Assigned</TableHead> : null}
            {columns.calls ? <TableHead>Calls</TableHead> : null}
            {columns.actions ? <TableHead className="text-right">Actions</TableHead> : null}
          </TableRow>
        </TableHeader>
        <motion.tbody
          data-slot="table-body"
          variants={motionVariants.listStagger}
          initial="hidden"
          animate="show"
          className="[&_tr:last-child]:border-0 in-data-[zebra=true]:[&_tr:nth-child(even)]:bg-bg-surface-sunken/60"
        >
          {items.map((item) => {
            const burden = adlBurden(item);
            const payer = item.prospectiveClient?.primary_payer
              ? payerLabels[item.prospectiveClient.primary_payer] ??
                item.prospectiveClient.primary_payer
              : "Payer TBD";
            const overdue = isOverdue(item.next_followup_at);
            const dueToday = isToday(item.next_followup_at);

            return (
              <motion.tr
                key={item.id}
                variants={motionVariants.fadeUp}
                data-slot="table-row"
                data-compact={density === "compact" || undefined}
                data-selected={selectedSet.has(item.id) || undefined}
                onClick={() => openLead(item.id)}
                onDoubleClick={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  setPreviewLead(item);
                }}
                className={cn(
                  "group/row h-12 cursor-pointer border-b border-border-subtle transition-colors duration-fast motion-reduce:transition-none hover:bg-bg-muted has-aria-expanded:bg-bg-muted data-[compact=true]:h-10 data-[selected=true]:bg-bg-emphasis data-[selected=true]:hover:bg-[var(--brand-navy-100)] data-[state=selected]:bg-bg-emphasis",
                  "group"
                )}
              >
                <TableCell onClick={(event) => event.stopPropagation()}>
                  <input
                    type="checkbox"
                    checked={selectedSet.has(item.id)}
                    onChange={() => toggleSelected(item.id)}
                    aria-label={`Select ${clientName(item)}`}
                  />
                </TableCell>
                {columns.status ? (
                  <TableCell>
                    <Badge variant={statusVariant(item)} tone="subtle">
                      {statusLabels[item.lead_status] ?? item.lead_status}
                    </Badge>
                  </TableCell>
                ) : null}
                {columns.leadType ? (
                  <TableCell>
                    <Badge variant="neutral" tone="subtle">
                      {leadTypeLabels[item.lead_type] ?? item.lead_type}
                    </Badge>
                  </TableCell>
                ) : null}
                {columns.client ? (
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <Avatar size="sm">
                        <AvatarFallback>{initials(clientName(item))}</AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="font-medium text-fg-primary">{clientName(item)}</p>
                        <p className="text-xs text-fg-tertiary">
                          {item.prospectiveClient?.address_city ?? "City TBD"} · {payer}
                        </p>
                      </div>
                    </div>
                  </TableCell>
                ) : null}
                {columns.contact ? (
                  <TableCell>
                    <p className="font-medium">{item.primaryContact?.full_name ?? "Unknown"}</p>
                    <p className="text-xs text-fg-tertiary">
                      {item.primaryContact?.phone ? formatPhone(item.primaryContact.phone) : "No phone"}
                    </p>
                  </TableCell>
                ) : null}
                {columns.adl ? (
                  <TableCell>
                    <Tooltip>
                      <TooltipTrigger render={<span />}>
                        <span className="inline-flex items-center gap-1">
                          {Array.from({ length: 6 }).map((_, index) => (
                            <span
                              key={index}
                              className={cn(
                                "h-2 w-3 rounded-sm bg-bg-muted",
                                index < burden && "bg-accent-primary"
                              )}
                            />
                          ))}
                        </span>
                      </TooltipTrigger>
                      <TooltipContent>{adlSummary(item)}</TooltipContent>
                    </Tooltip>
                  </TableCell>
                ) : null}
                {columns.urgency ? (
                  <TableCell>
                    {item.urgency ? (
                      <Badge variant={urgencyVariant(item.urgency)} dot>
                        {item.urgency}
                      </Badge>
                    ) : (
                      <span className="text-fg-tertiary">Unset</span>
                    )}
                  </TableCell>
                ) : null}
                {columns.lastContact ? (
                  <TableCell>
                    <span className="inline-flex items-center gap-1">
                      {isOverdue(item.last_contact_at) ? (
                        <ClockIcon className="size-3.5 text-danger-fg" />
                      ) : null}
                      {formatRelativeTime(item.last_contact_at) || "Never"}
                    </span>
                  </TableCell>
                ) : null}
                {columns.nextFollowup ? (
                  <TableCell
                    className={cn(
                      overdue && "font-medium text-danger-fg",
                      dueToday && "font-medium text-warning-fg"
                    )}
                  >
                    <p>{formatDate(item.next_followup_at) || "Not scheduled"}</p>
                    {item.next_followup_at ? (
                      <p className="text-xs text-fg-tertiary">{formatRelativeTime(item.next_followup_at)}</p>
                    ) : null}
                  </TableCell>
                ) : null}
                {columns.assigned ? (
                  <TableCell>
                    {item.profiles ? (
                      <Tooltip>
                        <TooltipTrigger render={<span />}>
                          <span className="inline-flex items-center gap-2">
                            <Avatar size="sm">
                              <AvatarFallback>
                                {initials(item.profiles.full_name, item.profiles.email)}
                              </AvatarFallback>
                            </Avatar>
                            <span className="max-w-32 truncate">
                              {item.profiles.full_name ?? item.profiles.email}
                            </span>
                          </span>
                        </TooltipTrigger>
                        <TooltipContent>{item.profiles.email}</TooltipContent>
                      </Tooltip>
                    ) : (
                      <Avatar size="sm" className="border border-dashed border-border-strong bg-transparent">
                        <AvatarFallback>?</AvatarFallback>
                      </Avatar>
                    )}
                  </TableCell>
                ) : null}
                {columns.calls ? (
                  <TableCell onClick={(event) => event.stopPropagation()}>
                    <Badge
                      variant="info"
                      render={<Link href={`/dashboard/calls?lead=${item.id}`} />}
                    >
                      {item.callCount}
                    </Badge>
                  </TableCell>
                ) : null}
                {columns.actions ? (
                  <TableCell className="text-right" onClick={(event) => event.stopPropagation()}>
                    <LeadActions
                      pending={pending}
                      onOpen={() => openLead(item.id)}
                      onAssign={() => run(() => assignLeadToMe(item.id))}
                      onContacted={() => run(() => markLeadContacted(item.id))}
                      onFlag={() => run(() => flagLead(item.id))}
                      onArchive={() => run(() => archiveLead(item.id))}
                      onSchedule={() => {
                        setScheduleLead(item.id);
                        setFollowupDate("");
                      }}
                    />
                  </TableCell>
                ) : null}
              </motion.tr>
            );
          })}
        </motion.tbody>
      </Table>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-fg-tertiary">
          Showing {first}-{last} of {totalFiltered}
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={filters.pageSize}
            onChange={(event) => setPageParam("pageSize", event.target.value)}
            className="h-8 rounded-md border border-border-default bg-bg-surface px-2 text-sm"
          >
            {[25, 50, 100].map((size) => (
              <option key={size} value={size}>
                {size} / page
              </option>
            ))}
          </select>
          <Button
            variant="secondary"
            size="sm"
            disabled={filters.page <= 1}
            render={<Link href={pageHref(filters.page - 1)} />}
          >
            Previous
          </Button>
          <span className="text-sm text-fg-secondary">
            Page {filters.page} of {totalPages}
          </span>
          <Button
            variant="secondary"
            size="sm"
            disabled={filters.page >= totalPages}
            render={<Link href={pageHref(filters.page + 1)} />}
          >
            Next
          </Button>
        </div>
      </div>

      <LeadPreviewSheet lead={previewLead} onOpenChange={(open) => !open && setPreviewLead(null)} />

      <Dialog open={Boolean(scheduleLead)} onOpenChange={(open) => !open && setScheduleLead(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Schedule follow-up</DialogTitle>
          </DialogHeader>
          <Input type="date" value={followupDate} onChange={(event) => setFollowupDate(event.target.value)} />
          <DialogFooter showCloseButton>
            <Button
              disabled={pending || !followupDate || !scheduleLead}
              onClick={() =>
                scheduleLead &&
                run(() => scheduleFollowUp({ leadId: scheduleLead, nextFollowupAt: followupDate }))
              }
            >
              Save follow-up
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function LeadActions({
  pending,
  onOpen,
  onAssign,
  onContacted,
  onSchedule,
  onFlag,
  onArchive,
}: {
  pending: boolean;
  onOpen: () => void;
  onAssign: () => void;
  onContacted: () => void;
  onSchedule: () => void;
  onFlag: () => void;
  onArchive: () => void;
}) {
  return (
    <div className="inline-flex opacity-0 transition-opacity duration-fast group-hover:opacity-100 group-focus-within:opacity-100">
      <DropdownMenu>
        <DropdownMenuTrigger render={<Button variant="tertiary" size="icon-sm" aria-label="Lead actions" />}>
          <MoreHorizontalIcon />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-52">
          <DropdownMenuItem onClick={onOpen}>Open</DropdownMenuItem>
          <DropdownMenuItem onClick={onAssign} disabled={pending}>Assign to me</DropdownMenuItem>
          <DropdownMenuItem onClick={onContacted} disabled={pending}>
            <CheckIcon />
            Mark contacted
          </DropdownMenuItem>
          <DropdownMenuItem onClick={onSchedule}>
            <CalendarClockIcon />
            Schedule follow-up
          </DropdownMenuItem>
          <DropdownMenuItem onClick={onFlag} disabled={pending}>Flag</DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={onArchive} disabled={pending} variant="destructive">
            Archive
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

function LeadPreviewSheet({
  lead,
  onOpenChange,
}: {
  lead: LeadListItem | null;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Sheet open={Boolean(lead)} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="max-w-[480px]">
        {lead ? (
          <>
            <SheetHeader>
              <SheetTitle>{clientName(lead)}</SheetTitle>
              <div className="flex flex-wrap gap-2">
                <Badge variant="neutral">{leadTypeLabels[lead.lead_type] ?? lead.lead_type}</Badge>
                <Badge variant={statusVariant(lead)}>{statusLabels[lead.lead_status] ?? lead.lead_status}</Badge>
              </div>
            </SheetHeader>
            <div className="grid gap-5 overflow-y-auto">
              <section className="grid grid-cols-2 gap-3 text-sm">
                <Fact label="DOB" value="Not captured" />
                <Fact label="Address" value={lead.prospectiveClient?.address_city ?? "Not captured"} />
                <Fact
                  label="Payer"
                  value={
                    lead.prospectiveClient?.primary_payer
                      ? payerLabels[lead.prospectiveClient.primary_payer] ??
                        lead.prospectiveClient.primary_payer
                      : "Not captured"
                  }
                />
                <Fact label="ADL summary" value={`${adlBurden(lead)} of 6 ADLs need assistance`} />
                <Fact label="Last call" value={formatRelativeTime(lead.last_contact_at) || "Never"} />
                <Fact label="Calls" value={String(lead.callCount)} />
              </section>
              <section>
                <h3 className="mb-3 text-sm font-semibold">Recent activity</h3>
                <ol className="grid gap-3 border-l border-border-subtle pl-4">
                  {[
                    "Lead created from intake workflow",
                    lead.flagged ? "Manual review flag added" : "No flags recorded",
                    lead.next_followup_at
                      ? `Follow-up scheduled ${formatRelativeTime(lead.next_followup_at)}`
                      : "No follow-up scheduled",
                    lead.profiles ? `Assigned to ${lead.profiles.full_name ?? lead.profiles.email}` : "Unassigned",
                    lead.notes ?? "No notes captured",
                  ].map((item, index) => (
                    <li key={index} className="relative text-sm text-fg-secondary before:absolute before:-left-[21px] before:top-1.5 before:size-2 before:rounded-full before:bg-accent-secondary">
                      {item}
                    </li>
                  ))}
                </ol>
              </section>
            </div>
            <SheetFooter>
              <Button render={<Link href={`/dashboard/leads/${lead.id}`} />}>Open full lead</Button>
              <Button variant="secondary">Assign to me</Button>
            </SheetFooter>
          </>
        ) : null}
      </SheetContent>
    </Sheet>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border-subtle bg-bg-surface-sunken p-3">
      <p className="text-xs font-medium tracking-wide text-fg-tertiary uppercase">{label}</p>
      <p className="mt-1 text-sm text-fg-primary">{value}</p>
    </div>
  );
}
