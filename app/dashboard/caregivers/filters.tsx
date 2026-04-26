"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  caregiverStatuses,
  certificationOptions,
  experienceRanges,
} from "@/app/dashboard/caregivers/filter-options";
import type { CaregiverFilters } from "@/app/dashboard/caregivers/types";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";

export function CaregiverFilterBar({ filters }: { filters: CaregiverFilters }) {
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

  function toggleCertification(cert: string) {
    const next = new URLSearchParams(searchParams.toString());
    const values = (next.get("cert") ?? "").split(",").filter(Boolean);
    const updated = values.includes(cert)
      ? values.filter((item) => item !== cert)
      : [...values, cert];
    if (updated.length) {
      next.set("cert", updated.join(","));
    } else {
      next.delete("cert");
    }
    router.push(`${pathname}?${next.toString()}`);
  }

  return (
    <section className="grid gap-4 rounded-xl border border-border-default bg-bg-surface p-4 shadow-xs">
      <div className="grid gap-3 lg:grid-cols-5">
      <label className="grid gap-1 text-xs font-medium text-fg-tertiary">
        Status
        <select
          className="h-9 rounded-md border border-border-default bg-bg-surface px-2 text-sm text-fg-primary"
          value={filters.status}
          onChange={(event) => setParam("status", event.target.value)}
        >
          {caregiverStatuses.map((status) => (
            <option key={status} value={status}>
              {status.replaceAll("_", " ")}
            </option>
          ))}
        </select>
      </label>
      <label className="grid gap-1 text-xs font-medium text-fg-tertiary">
        City
        <Input
          defaultValue={filters.city}
          placeholder="Filter by city"
          onBlur={(event) => setParam("city", event.target.value)}
        />
      </label>
      <label className="grid gap-1 text-xs font-medium text-fg-tertiary">
        Experience
        <select
          className="h-9 rounded-md border border-border-default bg-bg-surface px-2 text-sm text-fg-primary"
          value={filters.experience}
          onChange={(event) => setParam("experience", event.target.value)}
        >
          {experienceRanges.map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </label>
      <label className="grid gap-1 text-xs font-medium text-fg-tertiary">
        Languages
        <Input
          defaultValue={filters.language === "all" ? "" : filters.language}
          placeholder="English, Arabic, Spanish"
          onBlur={(event) => setParam("language", event.target.value || "all")}
        />
      </label>
      <label className="grid gap-1 text-xs font-medium text-fg-tertiary">
        Transportation
        <select
          className="h-9 rounded-md border border-border-default bg-bg-surface px-2 text-sm text-fg-primary"
          value={filters.transportation}
          onChange={(event) => setParam("transportation", event.target.value)}
        >
          <option value="all">Any</option>
          <option value="yes">Has transportation</option>
          <option value="no">Needs transportation</option>
        </select>
      </label>
      </div>
      <div className="flex flex-wrap items-center gap-3">
      <details className="rounded-lg border border-border-subtle p-2">
        <summary className="cursor-pointer text-sm font-medium">Certifications</summary>
        <div className="mt-2 flex flex-wrap gap-2">
          {certificationOptions.map(([value, label]) => (
            <label key={value} className="flex items-center gap-2 text-xs">
              <input
                type="checkbox"
                checked={filters.certifications.includes(value)}
                onChange={() => toggleCertification(value)}
              />
              <Badge variant="neutral">{label}</Badge>
            </label>
          ))}
        </div>
      </details>
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={filters.champsReady}
          onChange={(event) => setParam("champs", event.target.checked ? "1" : "")}
        />
        CHAMPS ready
      </label>
      </div>
    </section>
  );
}
