"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import type { Activity, Lead } from "@/app/dashboard/leads/[id]/types";
import { addNote } from "@/app/dashboard/leads/[id]/actions";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

export function NotesTab({
  lead,
  noteActivities,
}: {
  lead: Lead;
  noteActivities: Activity[];
}) {
  const [note, setNote] = useState("");
  const [pending, startTransition] = useTransition();

  function save() {
    startTransition(async () => {
      const result = await addNote({ leadId: lead.id, note });
      if (result.ok) {
        toast.success(result.message);
        setNote("");
      } else {
        toast.error(result.message);
      }
    });
  }

  return (
    <div className="grid gap-4">
      <section className="grid gap-3 rounded-xl border border-border-default bg-bg-surface p-4">
        <div>
          <h2 className="text-sm font-semibold">Add note</h2>
          <p className="text-xs text-fg-tertiary">
            Basic markdown is supported: **bold**, *italic*, and list lines.
          </p>
        </div>
        <Textarea
          value={note}
          onChange={(event) => setNote(event.target.value)}
          placeholder="Write a clinical handoff note..."
          className="min-h-32"
        />
        <div className="flex justify-end">
          <Button disabled={pending || !note.trim()} onClick={save}>
            Save note
          </Button>
        </div>
      </section>
      <section className="rounded-xl border border-border-default bg-bg-surface p-4">
        <h2 className="mb-3 text-sm font-semibold">Note History</h2>
        <div className="grid gap-2">
          {noteActivities.length ? (
            noteActivities.map((activity) => (
              <div key={activity.id} className="rounded-lg border border-border-subtle bg-bg-surface-sunken p-3">
                <div className="prose prose-sm max-w-none text-fg-primary">
                  {renderMarkdownish(activity.summary)}
                </div>
                <p className="mt-2 text-xs text-fg-tertiary">
                  {activity.profiles?.full_name || activity.profiles?.email || "AI"} ·{" "}
                  {activity.created_at
                    ? new Intl.DateTimeFormat("en-US", {
                        dateStyle: "short",
                        timeStyle: "short",
                      }).format(new Date(activity.created_at))
                    : "Unknown time"}
                </p>
              </div>
            ))
          ) : (
            <p className="text-sm text-fg-tertiary">No note history yet.</p>
          )}
        </div>
      </section>
    </div>
  );
}

function renderMarkdownish(value: string) {
  return value.split("\n").map((line, index) => {
    const content = line
      .replace(/\*\*(.*?)\*\*/g, "$1")
      .replace(/\*(.*?)\*/g, "$1");
    const list = /^[-*]\s+/.test(content);
    return (
      <p key={index} className={list ? "ml-4 list-item" : ""}>
        {content.replace(/^[-*]\s+/, "") || "\u00a0"}
      </p>
    );
  });
}
