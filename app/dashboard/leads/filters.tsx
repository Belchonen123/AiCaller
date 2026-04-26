"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ChevronDownIcon, SaveIcon, SearchIcon, XIcon } from "lucide-react";
import {
  leadStatusOptions,
  leadTypeOptions,
  payerOptions,
  urgencyOptions,
} from "@/app/dashboard/leads/list-config";
import type { LeadFilters, StaffRow } from "@/app/dashboard/leads/types";
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

type SavedView = {
  id: string;
  name: string;
  query: string;
};

const savedViewsKey = "actualizer-lead-saved-views";
const sourceOptions = [
  ["retell_call", "Retell call"],
  ["manual", "Manual"],
  ["referral", "Referral"],
  ["web", "Web"],
  ["other", "Other"],
] as const;

const leadTypeShortLabels: Record<string, string> = {
  client_referral: "Client",
  caregiver_applicant: "Caregiver",
  existing_client: "Existing",
  other: "Other",
};

const urgencyDotClass: Record<string, string> = {
  emergent: "bg-urgency-emergent",
  urgent: "bg-urgency-urgent",
  routine: "bg-urgency-routine",
  informational: "bg-urgency-informational",
};

function labelFor(
  key: string,
  value: string,
  staff: StaffRow[]
) {
  const option = [
    ...leadTypeOptions,
    ...leadStatusOptions,
    ...urgencyOptions,
    ...payerOptions,
  ].find(([optionValue]) => optionValue === value);

  if (option) {
    return option[1];
  }

  if (key === "assigned" && value === "unassigned") {
    return "Unassigned";
  }

  if (key === "view") {
    return value === "closed" ? "Closed" : value === "all" ? "All" : "Active";
  }

  if (key === "assigned") {
    return staff.find((member) => member.id === value)?.full_name ?? "Assigned";
  }

  if (key === "source") {
    return sourceOptions.find(([optionValue]) => optionValue === value)?.[1] ?? value;
  }

  if (key === "flags") {
    return "Has flags";
  }

  if (key === "from") {
    return `From ${value}`;
  }

  if (key === "to") {
    return `To ${value}`;
  }

  if (key === "search") {
    return `Search: ${value}`;
  }

  return value;
}

function readSavedViews(): SavedView[] {
  try {
    const parsed = JSON.parse(window.localStorage.getItem(savedViewsKey) ?? "[]");
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function SavedViewsMenu() {
  const searchParams = useSearchParams();
  const [views, setViews] = useState<SavedView[]>([]);

  useEffect(() => {
    setViews(readSavedViews());
  }, [searchParams]);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger render={<Button variant="secondary" />}>
        View saved
        <ChevronDownIcon />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        <DropdownMenuLabel>Saved filter sets</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {views.length ? (
          views.map((view) => (
            <DropdownMenuItem key={view.id} className="p-0">
              <Link href={`/dashboard/leads?${view.query}`} className="w-full px-2 py-1.5">
                {view.name}
              </Link>
            </DropdownMenuItem>
          ))
        ) : (
          <DropdownMenuItem disabled>No saved views yet</DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function LeadsFilterBar({
  filters,
  staff,
}: {
  filters: LeadFilters;
  staff: StaffRow[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [saveOpen, setSaveOpen] = useState(false);
  const [viewName, setViewName] = useState("");

  const params = useMemo(
    () => new URLSearchParams(searchParams.toString()),
    [searchParams]
  );

  function setParam(key: string, value: string) {
    const next = new URLSearchParams(searchParams.toString());
    if (value) {
      next.set(key, value);
    } else {
      next.delete(key);
    }
    next.delete("page");
    router.push(`${pathname}?${next.toString()}`);
  }

  function setStatusMode(value: LeadFilters["statusMode"]) {
    const next = new URLSearchParams(searchParams.toString());
    if (value === "active") {
      next.delete("view");
    } else {
      next.set("view", value);
    }
    next.delete("status");
    next.delete("page");
    router.push(`${pathname}?${next.toString()}`);
  }

  function toggleMulti(key: string, value: string) {
    const next = new URLSearchParams(searchParams.toString());
    const values = (next.get(key) ?? "")
      .split(",")
      .filter(Boolean);
    const updated = values.includes(value)
      ? values.filter((item) => item !== value)
      : [...values, value];

    if (updated.length) {
      next.set(key, updated.join(","));
    } else {
      next.delete(key);
    }
    next.delete("page");
    router.push(`${pathname}?${next.toString()}`);
  }

  function clearFilters() {
    router.push(pathname);
  }

  function removeChip(key: string, value: string) {
    if (["type", "status", "urgency", "payer"].includes(key)) {
      toggleMulti(key, value);
      return;
    }

    if (key === "view") {
      setStatusMode("active");
      return;
    }

    setParam(key, "");
  }

  function saveCurrentView() {
    const trimmed = viewName.trim();
    if (!trimmed) {
      return;
    }

    const views = readSavedViews();
    const next = [
      { id: crypto.randomUUID(), name: trimmed, query: searchParams.toString() },
      ...views.filter((view) => view.name !== trimmed),
    ].slice(0, 8);
    window.localStorage.setItem(savedViewsKey, JSON.stringify(next));
    setViewName("");
    setSaveOpen(false);
  }

  const activeChips = [
    ...(filters.statusMode !== "active"
      ? [{ key: "view", value: filters.statusMode }]
      : []),
    ...["type", "status", "urgency", "payer"].flatMap((key) =>
      (params.get(key) ?? "")
        .split(",")
        .filter(Boolean)
        .map((value) => ({ key, value }))
    ),
    ...(params.get("assigned")
      ? [{ key: "assigned", value: params.get("assigned") ?? "" }]
      : []),
    ...(params.get("search")
      ? [{ key: "search", value: params.get("search") ?? "" }]
      : []),
    ...(params.get("source")
      ? [{ key: "source", value: params.get("source") ?? "" }]
      : []),
    ...(params.get("from") ? [{ key: "from", value: params.get("from") ?? "" }] : []),
    ...(params.get("to") ? [{ key: "to", value: params.get("to") ?? "" }] : []),
    ...(params.get("flags") ? [{ key: "flags", value: "1" }] : []),
    ...(params.get("my") ? [{ key: "my", value: "My leads" }] : []),
  ];

  return (
    <section className="grid gap-3 rounded-xl border border-border-default bg-bg-surface p-4 shadow-xs">
      <div className="grid gap-3 xl:grid-cols-[auto_auto_auto_13rem_1fr]">
        <div className="flex h-9 rounded-full border border-border-default bg-bg-surface-sunken p-0.5">
          {[
            ["active", "Active"],
            ["closed", "Closed"],
            ["all", "All"],
          ].map(([value, label]) => (
            <button
              key={value}
              type="button"
              onClick={() => setStatusMode(value as LeadFilters["statusMode"])}
              className={cn(
                "rounded-full px-3 text-sm font-medium text-fg-secondary transition-colors duration-fast",
                filters.statusMode === value &&
                  "bg-accent-primary text-fg-on-brand shadow-sm"
              )}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          {leadTypeOptions.map(([value, label]) => (
            <Pill
              key={value}
              active={filters.leadTypes.includes(value)}
              onClick={() => toggleMulti("type", value)}
            >
              {leadTypeShortLabels[value] ?? label}
            </Pill>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          {urgencyOptions.map(([value, label]) => (
            <Pill
              key={value}
              active={filters.urgencies.includes(value)}
              onClick={() => toggleMulti("urgency", value)}
            >
              <span className={cn("size-1.5 rounded-full", urgencyDotClass[value])} />
              {label}
            </Pill>
          ))}
        </div>

        <select
          className="h-9 rounded-md border border-border-default bg-bg-surface px-2 text-sm text-fg-primary shadow-xs"
          value={filters.assignedTo}
          onChange={(event) => setParam("assigned", event.target.value)}
        >
          <option value="anyone">Anyone</option>
          <option value="unassigned">Unassigned</option>
          {staff.map((member) => (
            <option key={member.id} value={member.id}>
              {member.full_name ?? member.email}
            </option>
          ))}
        </select>

        <Input
          prefix={<SearchIcon className="size-4 text-fg-tertiary" />}
          placeholder="Search by name, phone, notes..."
          defaultValue={filters.search}
          onBlur={(event) => setParam("search", event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              setParam("search", event.currentTarget.value);
            }
          }}
        />
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Button
          type="button"
          variant="tertiary"
          size="sm"
          onClick={() => setAdvancedOpen((current) => !current)}
          iconRight={
            <ChevronDownIcon
              className={cn("transition-transform", advancedOpen && "rotate-180")}
            />
          }
        >
          More filters
        </Button>
        <Dialog open={saveOpen} onOpenChange={setSaveOpen}>
          <DialogTrigger render={<Button type="button" variant="secondary" size="sm" />}>
            <SaveIcon />
            Save current view
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Save current lead view</DialogTitle>
            </DialogHeader>
            <Input
              label="View name"
              value={viewName}
              onChange={(event) => setViewName(event.target.value)}
              placeholder="e.g. Urgent Medicaid follow-ups"
            />
            <DialogFooter showCloseButton>
              <Button onClick={saveCurrentView} disabled={!viewName.trim()}>
                Save view
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {advancedOpen ? (
        <div className="grid gap-3 rounded-lg border border-border-subtle bg-bg-surface-sunken p-3 lg:grid-cols-[1.5fr_10rem_10rem_12rem_auto]">
          <FilterGroup
            label="Payer"
            options={payerOptions}
            selected={filters.payers}
            onToggle={(value) => toggleMulti("payer", value)}
          />
          <Input
            type="date"
            value={filters.from}
            onChange={(event) => setParam("from", event.target.value)}
          />
          <Input
            type="date"
            value={filters.to}
            onChange={(event) => setParam("to", event.target.value)}
          />
          <select
            className="h-9 rounded-md border border-border-default bg-bg-surface px-2 text-sm text-fg-primary shadow-xs"
            value={filters.source}
            onChange={(event) => setParam("source", event.target.value)}
          >
            <option value="">Any source</option>
            {sourceOptions.map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
          <label className="flex h-9 items-center gap-2 text-sm text-fg-secondary">
            <input
              type="checkbox"
              checked={filters.hasFlags}
              onChange={(event) => setParam("flags", event.target.checked ? "1" : "")}
            />
            Has flags
          </label>
        </div>
      ) : null}

      <div className="flex flex-wrap items-center gap-2">
        {activeChips.map((chip) => (
          <Badge
            key={`${chip.key}-${chip.value}`}
            variant="neutral"
            tone="subtle"
            className="gap-1.5 pr-1"
          >
            {labelFor(chip.key, chip.value, staff)} x
            <button
              type="button"
              onClick={() => removeChip(chip.key, chip.value)}
              aria-label={`Remove ${labelFor(chip.key, chip.value, staff)} filter`}
              className="rounded-full p-0.5 hover:bg-bg-muted"
            >
              <XIcon className="size-3" />
            </button>
          </Badge>
        ))}
        {activeChips.length ? (
          <Button variant="link" size="sm" onClick={clearFilters}>
            Clear all
          </Button>
        ) : null}
      </div>
    </section>
  );
}

function FilterGroup({
  label,
  options,
  selected,
  onToggle,
}: {
  label: string;
  options: readonly (readonly [string, string])[];
  selected: string[];
  onToggle: (value: string) => void;
}) {
  return (
    <div className="grid gap-2">
      <p className="text-xs font-medium tracking-wide text-fg-tertiary uppercase">{label}</p>
      <div className="flex max-h-28 flex-wrap gap-1.5 overflow-y-auto">
        {options.map(([value, optionLabel]) => (
          <Pill key={value} active={selected.includes(value)} onClick={() => onToggle(value)}>
            {optionLabel}
          </Pill>
        ))}
      </div>
    </div>
  );
}

function Pill({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "inline-flex h-8 items-center gap-1.5 rounded-full border border-border-default bg-bg-surface px-3 text-xs font-medium text-fg-secondary transition-colors duration-fast hover:bg-bg-muted focus-visible:shadow-focus",
        active && "border-accent-primary bg-bg-emphasis text-fg-primary"
      )}
    >
      {children}
    </button>
  );
}
