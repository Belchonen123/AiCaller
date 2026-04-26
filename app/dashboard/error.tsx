"use client";

import Link from "next/link";
import { AlertTriangleIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  console.error("dashboard_render_error", {
    digest: error.digest,
    message: error.message,
  });

  return (
    <div className="flex min-h-[60svh] items-center justify-center">
      <Card className="mx-auto max-w-lg items-center text-center" padding="comfortable">
        <AlertTriangleIcon className="size-12 text-warning-fg" />
        <h1 className="mt-4 text-xl font-semibold">Something went wrong</h1>
        <p className="mt-2 text-sm text-fg-secondary">
          The dashboard could not finish loading. Try again; if it continues, contact support with the reference code below.
        </p>
        {error.digest ? (
          <p className="mt-2 font-mono text-xs text-fg-tertiary">Support code: {error.digest}</p>
        ) : null}
        <div className="mt-5 flex flex-wrap justify-center gap-2">
          <Button onClick={reset}>Try again</Button>
          <Button variant="secondary" render={<Link href="/dashboard" />}>
            Go to dashboard
          </Button>
          <Button variant="link" render={<a href="mailto:support@actualizer.ai?subject=Dashboard%20support%20request" />}>
            Contact support
          </Button>
        </div>
      </Card>
    </div>
  );
}
