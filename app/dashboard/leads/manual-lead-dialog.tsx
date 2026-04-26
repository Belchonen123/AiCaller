"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { createManualLead } from "@/app/dashboard/leads/actions";
import { leadTypeOptions } from "@/app/dashboard/leads/list-config";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function ManualLeadDialog({
  triggerLabel = "New lead (manual)",
  triggerVariant = "default",
}: {
  triggerLabel?: string;
  triggerVariant?: React.ComponentProps<typeof Button>["variant"];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [leadType, setLeadType] = useState("client_referral");
  const [pending, startTransition] = useTransition();

  function submit(formData: FormData) {
    startTransition(async () => {
      const result = await createManualLead({
        leadType,
        contactName: formData.get("contactName"),
        contactPhone: formData.get("contactPhone"),
        contactEmail: formData.get("contactEmail"),
        clientFirstName: formData.get("clientFirstName"),
        clientLastName: formData.get("clientLastName"),
        clientCity: formData.get("clientCity"),
      });

      if (result.ok && result.leadId) {
        toast.success(result.message);
        setOpen(false);
        router.push(`/dashboard/leads/${result.leadId}`);
      } else {
        toast.error(result.message);
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant={triggerVariant} />}>{triggerLabel}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create manual lead</DialogTitle>
        </DialogHeader>
        <form action={submit} className="grid gap-4">
          <div className="grid gap-2">
            <Label>Lead type</Label>
            <select
              className="h-9 rounded-lg border bg-background px-2 text-sm"
              value={leadType}
              onChange={(event) => setLeadType(event.target.value)}
            >
              {leadTypeOptions.map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="contactName">Primary contact name</Label>
            <Input id="contactName" name="contactName" required />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="contactPhone">Primary contact phone</Label>
            <Input id="contactPhone" name="contactPhone" />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="contactEmail">Primary contact email</Label>
            <Input id="contactEmail" name="contactEmail" type="email" />
          </div>
          {leadType === "client_referral" || leadType === "existing_client" ? (
            <div className="grid gap-3 rounded-lg border p-3">
              <p className="text-sm font-medium">Minimum client details</p>
              <Input name="clientFirstName" placeholder="Client first name" />
              <Input name="clientLastName" placeholder="Client last name" />
              <Input name="clientCity" placeholder="Client city" />
            </div>
          ) : null}
          <DialogFooter>
            <Button disabled={pending} type="submit">
              {pending ? "Creating..." : "Create lead"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
