"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { UploadCloudIcon } from "lucide-react";
import { toast } from "sonner";
import { CampaignUploadDialog } from "@/app/dashboard/campaigns/[id]/upload-dialog";
import { createCampaignDraft } from "@/app/dashboard/campaigns/actions";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getRetellPhoneNumberAgentIds } from "@/lib/retell/connection-state";

type CampaignOption = {
  id: string;
  name: string;
  status: string;
};

type AgentOption = {
  agent_id: string;
  agent_name?: string | null;
  name?: string | null;
};

type PhoneNumberOption = {
  phone_number: string;
  nickname?: string;
  agent_id?: string;
  inbound_agent_id?: string;
  outbound_agent_id?: string;
  agent_ids?: string[];
  inbound_agent_ids?: string[];
  outbound_agent_ids?: string[];
};

const purposes = [
  "reengagement",
  "followup",
  "referral_followup",
  "caregiver_recruitment",
  "eligibility_check",
  "general_outreach",
  "test",
] as const;

function agentLabel(agent: AgentOption) {
  return agent.agent_name ?? agent.name ?? agent.agent_id;
}

export function ImportCallListDialog({
  campaigns,
  hasRunningCampaigns,
  agents,
  phoneNumbers,
  trigger,
}: {
  campaigns: CampaignOption[];
  hasRunningCampaigns: boolean;
  agents: AgentOption[];
  phoneNumbers: PhoneNumberOption[];
  trigger?: React.ReactNode;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [mode, setMode] = useState<"existing" | "new">(
    campaigns.length > 0 ? "existing" : "new"
  );
  const [selectedCampaignId, setSelectedCampaignId] = useState(campaigns[0]?.id ?? "");
  const [selectedAgentId, setSelectedAgentId] = useState(agents[0]?.agent_id ?? "");
  const linkedPhoneNumbers = useMemo(
    () =>
      phoneNumbers.filter((phoneNumber) =>
        getRetellPhoneNumberAgentIds(phoneNumber).includes(selectedAgentId)
      ),
    [phoneNumbers, selectedAgentId]
  );
  const [selectedFromPhone, setSelectedFromPhone] = useState(
    linkedPhoneNumbers[0]?.phone_number ?? ""
  );
  const [resolvedCampaign, setResolvedCampaign] = useState<CampaignOption | null>(null);

  function selectAgent(agentId: string) {
    setSelectedAgentId(agentId);
    const nextPhone = phoneNumbers.find((phoneNumber) =>
      getRetellPhoneNumberAgentIds(phoneNumber).includes(agentId)
    );
    setSelectedFromPhone(nextPhone?.phone_number ?? "");
  }

  function openUploadForCampaign(campaign: CampaignOption) {
    setResolvedCampaign(campaign);
    setOpen(false);
    setUploadOpen(true);
  }

  function continueWithExistingCampaign() {
    const campaign = campaigns.find((item) => item.id === selectedCampaignId);
    if (!campaign) {
      toast.error("Choose a campaign first.");
      return;
    }

    openUploadForCampaign(campaign);
  }

  function createAndContinue(formData: FormData) {
    startTransition(async () => {
      const result = await createCampaignDraft({
        name: formData.get("name"),
        purpose: formData.get("purpose"),
        description: "",
        agent_id: selectedAgentId,
        from_phone: selectedFromPhone,
        script_variables: "{}",
        max_concurrent: 1,
        max_attempts_per_task: 3,
        retry_delay_minutes: 60,
        call_window_start: "09:00",
        call_window_end: "20:00",
        call_window_timezone: "America/Detroit",
      });

      if (!result.ok || !result.campaign_id) {
        toast.error(result.message);
        return;
      }

      toast.success("Campaign draft created.");
      openUploadForCampaign({
        id: result.campaign_id,
        name: String(formData.get("name") ?? "Imported calling list"),
        status: "draft",
      });
    });
  }

  return (
    <>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger render={<Button variant="secondary" />}>
          {trigger ?? (
            <>
              <UploadCloudIcon />
              Import calling list
            </>
          )}
        </DialogTrigger>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Import a calling list</DialogTitle>
            <DialogDescription>
              Choose where the CSV tasks should land, then upload and validate the list.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-3">
            <p className="text-sm font-semibold">Step 1: Pick destination campaign</p>
            <div className="grid gap-3">
              {campaigns.length > 0 ? (
                <label className="grid gap-2 rounded-lg border border-border-default p-3">
                  <span className="flex items-center gap-2 font-medium">
                    <input
                      type="radio"
                      name="import_mode"
                      checked={mode === "existing"}
                      onChange={() => setMode("existing")}
                    />
                    Add to existing campaign
                  </span>
                  {mode === "existing" ? (
                    <select
                      value={selectedCampaignId}
                      onChange={(event) => setSelectedCampaignId(event.target.value)}
                      className="h-9 rounded-lg border bg-background px-2 text-sm"
                    >
                      {campaigns.map((campaign) => (
                        <option key={campaign.id} value={campaign.id}>
                          {campaign.name} ({campaign.status})
                        </option>
                      ))}
                    </select>
                  ) : null}
                </label>
              ) : null}

              {hasRunningCampaigns ? (
                <p className="rounded-lg border border-warning-border bg-warning-bg p-3 text-sm text-warning-fg">
                  Running campaigns cannot accept uploads. Pause the campaign to add tasks.
                </p>
              ) : null}

              <label className="grid gap-2 rounded-lg border border-border-default p-3">
                <span className="flex items-center gap-2 font-medium">
                  <input
                    type="radio"
                    name="import_mode"
                    checked={mode === "new"}
                    onChange={() => setMode("new")}
                  />
                  Create new campaign for this list
                </span>
              </label>
            </div>

            {mode === "new" ? (
              <form className="grid gap-3 rounded-lg border bg-bg-surface-sunken p-3" action={createAndContinue}>
                <div className="grid gap-3 md:grid-cols-2">
                  <label className="grid gap-1">
                    <Label>Name</Label>
                    <Input name="name" required placeholder="Spring outreach list" />
                  </label>
                  <label className="grid gap-1">
                    <Label>Purpose</Label>
                    <select
                      name="purpose"
                      required
                      defaultValue="followup"
                      className="h-9 rounded-lg border bg-background px-2 text-sm"
                    >
                      {purposes.map((purpose) => (
                        <option key={purpose} value={purpose}>
                          {purpose.replaceAll("_", " ")}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
                <div className="grid gap-3 md:grid-cols-2">
                  <label className="grid gap-1">
                    <Label>Agent</Label>
                    <select
                      value={selectedAgentId}
                      required
                      className="h-9 rounded-lg border bg-background px-2 text-sm"
                      onChange={(event) => selectAgent(event.target.value)}
                    >
                      <option value="" disabled>
                        Select an agent
                      </option>
                      {agents.map((agent) => (
                        <option key={agent.agent_id} value={agent.agent_id}>
                          {agentLabel(agent)}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="grid gap-1">
                    <Label>From phone</Label>
                    <select
                      value={selectedFromPhone}
                      required
                      className="h-9 rounded-lg border bg-background px-2 text-sm"
                      onChange={(event) => setSelectedFromPhone(event.target.value)}
                    >
                      <option value="" disabled>
                        Select a number linked to this agent
                      </option>
                      {linkedPhoneNumbers.map((phoneNumber) => (
                        <option key={phoneNumber.phone_number} value={phoneNumber.phone_number}>
                          {phoneNumber.nickname
                            ? `${phoneNumber.nickname} (${phoneNumber.phone_number})`
                            : phoneNumber.phone_number}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
                <p className="text-xs text-fg-tertiary">
                  Defaults: 1 concurrent call, 3 attempts, 60 minute retry delay, 9:00 AM-8:00 PM
                  America/Detroit.
                </p>
                <DialogFooter>
                  <Button type="submit" disabled={pending || !selectedAgentId || !selectedFromPhone}>
                    {pending ? "Creating..." : "Create campaign and continue"}
                  </Button>
                </DialogFooter>
              </form>
            ) : (
              <DialogFooter>
                <Button type="button" onClick={continueWithExistingCampaign}>
                  Continue to upload
                </Button>
              </DialogFooter>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {resolvedCampaign ? (
        <CampaignUploadDialog
          campaignId={resolvedCampaign.id}
          campaignName={resolvedCampaign.name}
          trigger={null}
          open={uploadOpen}
          onOpenChange={setUploadOpen}
          onUploaded={({ accepted, filename }) => {
            const params = new URLSearchParams({
              upload_tasks: String(accepted),
              upload_file: filename || "CSV upload",
            });
            router.push(`/dashboard/campaigns/${resolvedCampaign.id}?${params.toString()}`);
          }}
        />
      ) : null}
    </>
  );
}
