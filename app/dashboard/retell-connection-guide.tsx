"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { AlertTriangleIcon, ExternalLinkIcon, RefreshCwIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import type { RetellConnectionState } from "@/lib/retell/connection-state";

type ConnectionGuideProps = {
  connectionState: RetellConnectionState;
  issues: string[];
};

function setupTarget(connectionState: RetellConnectionState) {
  switch (connectionState) {
    case "no_agents":
      return {
        label: "Open setup",
        href: "/dashboard/agents",
        external: false,
      };
    case "no_phone_numbers":
    case "no_linked_pair":
      return {
        label: "Open Retell",
        href: "https://dashboard.retellai.com",
        external: true,
      };
    case "no_api_key":
      return {
        label: "Open settings",
        href: "/dashboard/settings",
        external: false,
      };
    default:
      return null;
  }
}

export function RetellConnectionGuide({ connectionState, issues }: ConnectionGuideProps) {
  const router = useRouter();
  const target = setupTarget(connectionState);

  return (
    <Card elevation="raised" padding="comfortable" className="gap-5">
      <div className="flex items-start gap-3">
        <div className="grid size-10 shrink-0 place-items-center rounded-full bg-warning-bg text-warning-fg">
          <AlertTriangleIcon className="size-5" />
        </div>
        <div>
          <h2 className="font-heading text-xl font-semibold">Retell isn&apos;t connected yet</h2>
          <p className="mt-1 text-sm text-fg-secondary">
            Finish these setup steps before placing test calls or starting outbound campaigns.
          </p>
        </div>
      </div>

      <ol className="grid gap-3">
        {issues.map((issue, index) => (
          <li
            key={`${connectionState}-${issue}`}
            className="grid gap-3 rounded-xl border border-border-default bg-bg-surface-sunken p-3 sm:grid-cols-[2rem_1fr_auto] sm:items-center"
          >
            <span className="grid size-8 place-items-center rounded-full bg-bg-surface text-sm font-semibold">
              {index + 1}
            </span>
            <p className="text-sm text-fg-secondary">{issue}</p>
            {target ? (
              target.external ? (
                <Button
                  variant="secondary"
                  size="sm"
                  render={
                    <a href={target.href} target="_blank" rel="noreferrer" />
                  }
                >
                  {target.label}
                  <ExternalLinkIcon />
                </Button>
              ) : (
                <Button variant="secondary" size="sm" render={<Link href={target.href} />}>
                  {target.label}
                </Button>
              )
            ) : null}
          </li>
        ))}
      </ol>

      <Button type="button" variant="outline" className="w-fit" onClick={() => router.refresh()}>
        <RefreshCwIcon />
        Recheck connection
      </Button>
    </Card>
  );
}
