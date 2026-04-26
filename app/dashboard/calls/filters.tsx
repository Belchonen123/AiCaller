"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import type { CallFilters } from "@/app/dashboard/calls/types";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

const statuses = ["all", "received", "extracted", "reviewed", "merged_into_lead"];
const confidences = ["all", "high", "medium", "low"];
const linkedOptions = ["all", "linked", "unlinked"];
const directions = ["all", "inbound", "outbound"];

export function CallsFilterBar({ filters }: { filters: CallFilters }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function setParam(key: string, value: string) {
    const next = new URLSearchParams(searchParams.toString());
    if (value && value !== "all") {
      next.set(key, value);
    } else {
      next.delete(key);
    }
    router.push(`${pathname}?${next.toString()}`);
  }

  function toggleConfidence(confidence: string) {
    const next = new URLSearchParams(searchParams.toString());
    if (confidence === "all") {
      next.delete("confidence");
      router.push(`${pathname}?${next.toString()}`);
      return;
    }
    const values = (next.get("confidence") ?? "").split(",").filter(Boolean);
    const updated = values.includes(confidence)
      ? values.filter((item) => item !== confidence)
      : [...values, confidence];
    if (updated.length) next.set("confidence", updated.join(","));
    else next.delete("confidence");
    router.push(`${pathname}?${next.toString()}`);
  }

  const selectedConfidence =
    filters.confidence === "all" ? [] : filters.confidence.split(",").filter(Boolean);

  return (
    <section className="grid gap-4 rounded-xl border border-border-default bg-bg-surface p-4 shadow-xs">
      <div className="grid gap-3 md:grid-cols-[1fr_1fr_1fr_1fr_1fr]">
        <SelectFilter label="Direction" value={filters.direction} options={directions} onChange={(value) => setParam("direction", value)} />
        <SelectFilter label="Status" value={filters.status} options={statuses} onChange={(value) => setParam("status", value)} />
        <SelectFilter label="Linked" value={filters.linked} options={linkedOptions} onChange={(value) => setParam("linked", value)} />
        <Input label="From" type="date" value={filters.from} onChange={(event) => setParam("from", event.target.value)} />
        <Input label="To" type="date" value={filters.to} onChange={(event) => setParam("to", event.target.value)} />
      </div>
      <div className="grid gap-3 md:grid-cols-[1fr_2fr] md:items-end">
        <Input
          label="Search"
          defaultValue={filters.search}
          placeholder="Phone, Retell ID, or note"
          onBlur={(event) => setParam("search", event.target.value)}
        />
        <div className="grid gap-1.5">
          <p className="text-xs font-medium text-fg-tertiary">Confidence</p>
          <div className="flex flex-wrap gap-2">
            {confidences.map((confidence) => {
              const active =
                confidence === "all"
                  ? selectedConfidence.length === 0
                  : selectedConfidence.includes(confidence);
              return (
                <button
                  key={confidence}
                  type="button"
                  onClick={() => toggleConfidence(confidence)}
                >
                  <Badge
                    variant={active ? "accent" : "neutral"}
                    className={cn("capitalize", active && "shadow-xs")}
                  >
                    {confidence}
                  </Badge>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}

function SelectFilter({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: string[];
  onChange: (value: string) => void;
}) {
  return (
    <label className="grid gap-1 text-xs font-medium text-fg-tertiary">
      {label}
      <select
        value={value}
        className="h-9 rounded-md border border-border-default bg-bg-surface px-2 text-sm text-fg-primary shadow-xs focus-visible:shadow-focus"
        onChange={(event) => onChange(event.target.value)}
      >
        {options.map((option) => (
          <option key={option} value={option}>
            {option.replaceAll("_", " ")}
          </option>
        ))}
      </select>
    </label>
  );
}
