import Link from "next/link";
import { AlertTriangleIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

export default function NotFound() {
  return (
    <main className="flex min-h-svh items-center justify-center bg-bg-page p-6">
      <Card className="max-w-md items-center text-center" padding="comfortable">
        <AlertTriangleIcon className="size-12 text-info-fg" />
        <h1 className="text-xl font-semibold">Page not found</h1>
        <p className="mt-2 text-sm text-fg-secondary">
          The page may have moved or you may not have access. Return to leads or contact support if this blocks intake work.
        </p>
        <div className="mt-4 flex flex-wrap justify-center gap-2">
          <Button render={<Link href="/dashboard/leads" />}>
            Go to leads
          </Button>
          <Button variant="link" render={<a href="mailto:support@actualizer.ai?subject=Missing%20page%20support%20request" />}>
            Contact support
          </Button>
        </div>
      </Card>
    </main>
  );
}
