import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { DashboardShell } from "@/app/dashboard/dashboard-shell";
import { getCurrentUser } from "@/lib/auth";
import { loadRetellSetupStatus } from "@/lib/retell/setup-status";

function getAppUrl(host: string | null, proto: string | null) {
  if (process.env.NEXT_PUBLIC_APP_URL) {
    return process.env.NEXT_PUBLIC_APP_URL.replace(/\/$/, "");
  }

  return host ? `${proto ?? "https"}://${host}` : "http://localhost:3000";
}

export default async function DashboardLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  try {
    const requestHeaders = await headers();
    const { profile, tenant } = await getCurrentUser();
    const pathname = requestHeaders.get("x-pathname") ?? "";
    const setup = await loadRetellSetupStatus({
      tenantId: profile.tenant_id,
      appUrl: getAppUrl(
        requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host"),
        requestHeaders.get("x-forwarded-proto")
      ),
    });

    if (/^\/dashboard\/leads\/[^/]+\/print$/.test(pathname)) {
      return children;
    }

    return (
      <DashboardShell
        tenantName={tenant.name}
        userName={profile.full_name ?? ""}
        userEmail={profile.email}
        setupIncomplete={!setup.allComplete}
      >
        {children}
      </DashboardShell>
    );
  } catch {
    redirect("/login");
  }
}
