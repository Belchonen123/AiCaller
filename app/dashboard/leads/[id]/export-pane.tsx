"use client";

import { toast } from "sonner";
import type {
  Contact,
  DetailRecord,
  Lead,
} from "@/app/dashboard/leads/[id]/types";
import { buildPlainTextSummary } from "@/app/dashboard/leads/[id]/summary";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

export function ExportPane({
  lead,
  primaryContact,
  prospectiveClient,
  caregiverApplicant,
}: {
  lead: Lead;
  primaryContact: Contact | null;
  prospectiveClient: DetailRecord | null;
  caregiverApplicant: DetailRecord | null;
}) {
  async function copySummary() {
    const summary = buildPlainTextSummary({
      lead,
      primaryContact,
      prospectiveClient,
      caregiverApplicant,
    });

    await navigator.clipboard.writeText(summary);
    toast.success("Intake summary copied.");
  }

  return (
    <aside className="grid gap-3 rounded-xl border bg-background p-4">
      <div>
        <h2 className="text-sm font-semibold">Export & Handoff</h2>
        <p className="text-xs text-muted-foreground">
          Share the reconciled intake packet with downstream systems.
        </p>
      </div>
      <Button
        variant="outline"
        render={<a href={`/dashboard/leads/${lead.id}/export`} />}
      >
        Export intake packet (CSV)
      </Button>
      <Button
        variant="outline"
        onClick={() => window.open(`/dashboard/leads/${lead.id}/print`, "_blank")}
      >
        Export intake packet (PDF)
      </Button>
      <Button variant="outline" onClick={copySummary}>
        Copy intake summary
      </Button>
      <Tooltip>
        <TooltipTrigger render={<span />}>
          <Button disabled className="w-full">
            Send to CHAMPS
          </Button>
        </TooltipTrigger>
        <TooltipContent>CHAMPS integration coming in v2.</TooltipContent>
      </Tooltip>
    </aside>
  );
}
