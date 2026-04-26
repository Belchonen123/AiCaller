import Link from "next/link";
import { UserRoundSearchIcon } from "lucide-react";
import { CaregiverFilterBar } from "@/app/dashboard/caregivers/filters";
import { parseCaregiverFilters, loadCaregiverApplicants } from "@/app/dashboard/caregivers/query";
import type { CaregiverApplicant } from "@/app/dashboard/caregivers/types";
import { PageHeader } from "@/components/page-header";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { getCurrentUser } from "@/lib/auth";
import { cn } from "@/lib/utils";

type CaregiversPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function fullName(applicant: CaregiverApplicant) {
  return [applicant.first_name, applicant.last_name].filter(Boolean).join(" ") || "Unnamed";
}

function appliedOn(applicant: CaregiverApplicant) {
  return applicant.leads?.first_contact_at
    ? new Intl.DateTimeFormat("en-US", {
        dateStyle: "short",
      }).format(new Date(applicant.leads.first_contact_at))
    : "";
}

function certifications(applicant: CaregiverApplicant) {
  return [
    applicant.cna_certified ? "CNA" : null,
    applicant.hha_certified ? "HHA" : null,
    applicant.cpr_certified ? "CPR" : null,
    applicant.first_aid_certified ? "FA" : null,
  ].filter((item): item is string => Boolean(item));
}

const pipeline = [
  "new",
  "phone_screened",
  "interview_scheduled",
  "background_pending",
  "cleared",
  "hired",
];

const certVariants: Record<string, "accent" | "success" | "info" | "warning"> = {
  CNA: "accent",
  HHA: "success",
  CPR: "info",
  FA: "warning",
};

function initials(name: string) {
  return name
    .split(/\s+/)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

function PipelineIndicator({ status }: { status: string | null }) {
  const normalized = status ?? "new";
  const activeIndex = Math.max(0, pipeline.indexOf(normalized));

  return (
    <div className="grid gap-1">
      <div className="flex gap-1">
        {pipeline.map((step, index) => (
          <span
            key={step}
            className={cn(
              "h-1.5 flex-1 rounded-full bg-bg-muted",
              index <= activeIndex && "bg-accent-secondary"
            )}
          />
        ))}
      </div>
      <span className="text-xs text-fg-tertiary">{normalized.replaceAll("_", " ")}</span>
    </div>
  );
}

export default async function CaregiversPage({ searchParams }: CaregiversPageProps) {
  const currentUser = await getCurrentUser();
  const rawSearchParams = await searchParams;
  const filters = parseCaregiverFilters(rawSearchParams);
  const applicants = await loadCaregiverApplicants({
    tenantId: currentUser.profile.tenant_id,
    filters,
  });
  const exportHref = `/api/export/caregivers?${new URLSearchParams(
    Object.entries(rawSearchParams).flatMap(([key, value]) =>
      Array.isArray(value) ? value.map((item) => [key, item]) : [[key, value ?? ""]]
    )
  ).toString()}`;

  return (
    <div className="grid gap-4">
      <PageHeader
        eyebrow="Operations"
        title="Caregivers"
        description="Track caregiver applicants routed from intake calls."
        actions={
          <a href={exportHref} className={buttonVariants({ variant: "outline" })}>
            Export caregivers CSV
          </a>
        }
      />

      <CaregiverFilterBar filters={filters} />

      {applicants.length ? (
          <Table className="min-w-[1100px]" stickyHeader>
            <TableHeader>
              <TableRow>
                <TableHead>Applicant</TableHead>
                <TableHead>City</TableHead>
                <TableHead>Status pipeline</TableHead>
                <TableHead>Experience</TableHead>
                <TableHead>Certifications</TableHead>
                <TableHead>Languages</TableHead>
                <TableHead>Referred by</TableHead>
                <TableHead>Applied</TableHead>
                <TableHead>Assigned</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {applicants.map((applicant) => (
                <TableRow key={applicant.id}>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <Avatar size="md">
                        <AvatarFallback>{initials(fullName(applicant))}</AvatarFallback>
                      </Avatar>
                      <div>
                        <Link href={`/dashboard/leads/${applicant.lead_id}`} className="font-medium text-fg-link hover:underline">
                          {fullName(applicant)}
                        </Link>
                        <p className="text-xs text-fg-tertiary">Lead {applicant.lead_id.slice(0, 8)}</p>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>{applicant.address_city ?? ""}</TableCell>
                  <TableCell className="min-w-56">
                    <PipelineIndicator status={applicant.status} />
                  </TableCell>
                  <TableCell>{applicant.years_experience ? `${applicant.years_experience} yr` : ""}</TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {certifications(applicant).map((cert) => (
                        <Badge key={cert} variant={certVariants[cert] ?? "neutral"}>
                          {cert}
                        </Badge>
                      ))}
                      {!certifications(applicant).length ? (
                        <span className="text-xs text-fg-tertiary">None captured</span>
                      ) : null}
                    </div>
                  </TableCell>
                  <TableCell>{applicant.languages_spoken?.join(", ") ?? ""}</TableCell>
                  <TableCell>{applicant.referred_by ?? ""}</TableCell>
                  <TableCell>{appliedOn(applicant)}</TableCell>
                  <TableCell>
                    {applicant.leads?.profiles?.full_name ??
                      applicant.leads?.profiles?.email ??
                      "Unassigned"}
                  </TableCell>
                  <TableCell>
                    <Link
                      href={`/dashboard/leads/${applicant.lead_id}`}
                      className={buttonVariants({ variant: "secondary", size: "sm" })}
                    >
                      Open lead
                    </Link>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
      ) : (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border-default bg-bg-surface px-6 py-16 text-center">
          <UserRoundSearchIcon className="mb-4 size-12 text-fg-tertiary" />
          <h2 className="font-heading text-lg font-semibold tracking-snug text-fg-primary">
            No caregiver applicants yet
          </h2>
          <p className="mx-auto mt-2 max-w-md text-sm leading-normal text-fg-secondary">
            The AI receptionist will route caregiver job calls here automatically with certification,
            language, and screening context.
          </p>
        </div>
      )}
    </div>
  );
}
