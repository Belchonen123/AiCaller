"use client";

import { useState, useTransition } from "react";
import { motion } from "framer-motion";
import {
  Edit3Icon,
  FileTextIcon,
  FlagIcon,
  HistoryIcon,
  PhoneIcon,
  UserPlusIcon,
} from "lucide-react";
import { loadMoreActivities } from "@/app/dashboard/leads/[id]/actions";
import type { Activity } from "@/app/dashboard/leads/[id]/types";
import { Button } from "@/components/ui/button";
import { formatDate, formatRelativeTime } from "@/lib/formatters";
import { useActualizerMotion } from "@/lib/motion";

function ActivityIcon({ type }: { type: string }) {
  const Icon =
    type === "flagged"
      ? FlagIcon
      : type.startsWith("call")
        ? PhoneIcon
        : type === "assignment"
          ? UserPlusIcon
          : type === "note"
            ? FileTextIcon
            : type === "field_updated"
              ? Edit3Icon
              : HistoryIcon;

  return <Icon className="size-4" />;
}

function dayKey(value: string | null) {
  return formatDate(value) || "Unknown date";
}

function activityGroup(type: string) {
  if (type.startsWith("call")) return "Calls";
  if (type === "status_change") return "Status";
  if (type === "field_updated") return "Field updates";
  if (type === "note") return "Notes";
  if (type === "flagged") return "Flags";
  return "All";
}

function diffText(detail: unknown, summary: string) {
  if (detail && typeof detail === "object" && "field" in detail) {
    const record = detail as Record<string, unknown>;
    const oldValue = typeof record.old === "string" ? record.old : null;
    const nextValue = typeof record.new === "string" ? record.new : null;
    if (oldValue || nextValue) {
      return (
        <span>
          Changed {String(record.field)} from{" "}
          <span className="text-fg-tertiary line-through">{oldValue ?? "empty"}</span> to{" "}
          <span className="font-medium">{nextValue ?? "empty"}</span>
        </span>
      );
    }
    return `Changed ${String(record.field)}`;
  }

  return summary;
}

export function ActivityTab({
  leadId,
  activities,
}: {
  leadId: string;
  activities: Activity[];
}) {
  const [items, setItems] = useState(activities);
  const [filter, setFilter] = useState("All");
  const [pending, startTransition] = useTransition();
  const motionVariants = useActualizerMotion();
  const filtered = items.filter((item) => filter === "All" || activityGroup(item.activity_type) === filter);
  let currentDay = "";

  function loadMore() {
    startTransition(async () => {
      const next = await loadMoreActivities({ leadId, offset: items.length });
      setItems((current) => [...current, ...next]);
    });
  }

  return (
    <div id="activity" className="grid gap-3">
      <div className="flex flex-wrap gap-2">
        {["All", "Calls", "Status", "Field updates", "Notes", "Flags"].map((item) => (
          <button
            key={item}
            type="button"
            onClick={() => setFilter(item)}
            className={`h-8 rounded-full border px-3 text-xs font-medium ${filter === item ? "border-accent-primary bg-bg-emphasis text-fg-primary" : "border-border-default text-fg-secondary"}`}
          >
            {item}
          </button>
        ))}
      </div>
      <motion.div
        variants={motionVariants.listStagger}
        initial="hidden"
        animate="show"
        className="relative grid gap-0"
      >
        {filtered.map((activity) => {
          const day = dayKey(activity.created_at);
          const showDay = day !== currentDay;
          currentDay = day;

          return (
            <motion.div key={activity.id} variants={motionVariants.fadeUp}>
              {showDay ? (
                <div className="sticky top-32 z-10 bg-bg-page py-2 text-xs font-semibold tracking-wide text-fg-tertiary uppercase">
                  {day}
                </div>
              ) : null}
              <div className="relative grid grid-cols-[2rem_1fr] gap-3 pb-4 before:absolute before:left-4 before:top-8 before:bottom-0 before:border-l-2 before:border-border-subtle">
                <div className="z-10 mt-0.5 grid size-8 place-items-center rounded-full border border-border-default bg-bg-surface text-fg-secondary">
                  <ActivityIcon type={activity.activity_type} />
                </div>
                <div className="rounded-xl border border-border-default bg-bg-surface p-3">
                  <p className="text-sm font-medium">{diffText(activity.detail, activity.summary)}</p>
                  <p className="text-xs text-fg-tertiary">
                    {activity.profiles?.full_name || activity.profiles?.email || "AI"} ·{" "}
                    {formatRelativeTime(activity.created_at) || "Unknown time"}
                  </p>
                </div>
              </div>
            </motion.div>
          );
        })}
      </motion.div>
      {items.length >= 50 ? (
        <Button variant="outline" disabled={pending} onClick={loadMore}>
          {pending ? "Loading..." : "Load more"}
        </Button>
      ) : null}
    </div>
  );
}
