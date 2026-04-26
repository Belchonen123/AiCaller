import dynamic from "next/dynamic";
import { notFound } from "next/navigation";
import { z } from "zod";
import {
  AuditTrail,
  ExtractionPanel,
  PhoneReveal,
  TranscriptView,
} from "@/app/dashboard/calls/[id]/call-detail-client";
import { loadCallDetail } from "@/app/dashboard/calls/query";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { getCurrentUser } from "@/lib/auth";
import { formatDate, formatDuration, formatTime } from "@/lib/formatters";

type CallDetailPageProps = {
  params: Promise<{
    id: string;
  }>;
};

const paramsSchema = z.object({
  id: z.uuid(),
});

const CallAudioPlayer = dynamic(() =>
  import("@/app/dashboard/calls/[id]/call-audio-player").then(
    (mod) => mod.CallAudioPlayer
  )
);

export default async function CallDetailPage({ params }: CallDetailPageProps) {
  const parsedParams = paramsSchema.safeParse(await params);

  if (!parsedParams.success) {
    notFound();
  }

  const currentUser = await getCurrentUser();
  const data = await loadCallDetail({
    tenantId: currentUser.profile.tenant_id,
    callId: parsedParams.data.id,
  });

  if (!data) {
    notFound();
  }

  const canRerun = ["admin", "owner"].includes(currentUser.profile.role);

  return (
    <div className="grid gap-5 pb-20">
      <PageHeader
        eyebrow="Call review"
        title="Call detail"
        description="Review the conversation, recording, extraction, and lead linkage in one chart-like workspace."
      />

      <Card elevation="raised" padding="compact">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-xl font-semibold">Call record</h1>
            <p className="break-all font-mono text-xs text-muted-foreground">
              {data.call.id}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Badge variant="outline">{data.call.call_direction ?? "inbound"}</Badge>
            <Badge>{data.call.status}</Badge>
            {data.call.extraction_confidence ? (
              <Badge variant="secondary">{data.call.extraction_confidence}</Badge>
            ) : null}
          </div>
        </div>
        <dl className="mt-4 grid gap-3 text-sm md:grid-cols-3">
          <div>
            <dt className="text-muted-foreground">Started</dt>
            <dd>{data.call.call_started_at ? `${formatDate(data.call.call_started_at)} ${formatTime(data.call.call_started_at)}` : "Not available"}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Ended</dt>
            <dd>{data.call.call_ended_at ? `${formatDate(data.call.call_ended_at)} ${formatTime(data.call.call_ended_at)}` : "Not available"}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Duration</dt>
            <dd>{formatDuration(data.call.duration_seconds)}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Phone</dt>
            <dd>
              <PhoneReveal
                phone={data.call.caller_phone_normalized ?? data.call.caller_phone}
              />
            </dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Disconnect reason</dt>
            <dd>{data.call.disconnect_reason ?? "Not provided"}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Retell call ID</dt>
            <dd className="break-all font-mono text-xs">{data.call.retell_call_id}</dd>
          </div>
        </dl>
      </Card>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,3fr)_minmax(22rem,2fr)]">
        <section className="grid gap-4">
          <CallAudioPlayer recordingUrl={data.call.recording_url} />
          <Card padding="compact">
            <h2 className="mb-3 font-heading text-lg font-semibold">Transcript</h2>
            <TranscriptView transcript={data.call.transcript} />
          </Card>
        </section>
        <ExtractionPanel
          call={data.call}
          relatedLeads={data.relatedLeads}
          canRerun={canRerun}
        />
      </div>

      <AuditTrail events={data.events} />
    </div>
  );
}
