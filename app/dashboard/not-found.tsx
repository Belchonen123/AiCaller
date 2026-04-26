import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

export default function DashboardNotFound() {
  return (
    <Card className="mx-auto max-w-lg p-6 text-center">
      <h1 className="text-xl font-semibold">Dashboard page not found</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        The dashboard page you requested does not exist.
      </p>
      <Button className="mt-4" render={<Link href="/dashboard/leads" />}>
        Back to leads
      </Button>
    </Card>
  );
}
