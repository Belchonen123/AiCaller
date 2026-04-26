"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import {
  assignLeadToMe,
  flagLead,
  markLeadContacted,
  scheduleFollowUp,
} from "@/app/dashboard/leads/actions";
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
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";

export function LeadQuickActions({ leadId }: { leadId: string }) {
  const [pending, startTransition] = useTransition();
  const [date, setDate] = useState("");

  function run(action: () => Promise<{ ok: boolean; message: string }>) {
    startTransition(async () => {
      const result = await action();
      if (result.ok) {
        toast.success(result.message);
      } else {
        toast.error(result.message);
      }
    });
  }

  return (
    <div className="flex items-center gap-2 opacity-0 transition-opacity group-hover:opacity-100">
      <DropdownMenu>
        <DropdownMenuTrigger render={<Button variant="outline" size="sm" />}>
          Actions
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={() => run(() => assignLeadToMe(leadId))}>
            Assign to me
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => run(() => markLeadContacted(leadId))}>
            Mark contacted
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => run(() => flagLead(leadId))}>
            Flag
          </DropdownMenuItem>
          <DropdownMenuItem className="p-0">
            <Link href={`/dashboard/leads/${leadId}`} className="w-full px-1.5 py-1">
              Open detail
            </Link>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <Dialog>
        <DialogTrigger render={<Button variant="outline" size="sm" />}>
          Schedule
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Schedule follow-up</DialogTitle>
          </DialogHeader>
          <Input type="date" value={date} onChange={(event) => setDate(event.target.value)} />
          <DialogFooter>
            <Button
              disabled={pending || !date}
              onClick={() => run(() => scheduleFollowUp({ leadId, nextFollowupAt: date }))}
            >
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
