"use client";

import { useEffect, useRef, useState } from "react";
import WaveSurfer from "wavesurfer.js";
import { Button } from "@/components/ui/button";

export function CallAudioPlayer({ recordingUrl }: { recordingUrl: string | null }) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const wavesurferRef = useRef<WaveSurfer | null>(null);
  const [playing, setPlaying] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!recordingUrl || !containerRef.current) return;

    const wavesurfer = WaveSurfer.create({
      container: containerRef.current,
      url: recordingUrl,
      height: 72,
      waveColor: "var(--brand-navy-200)",
      progressColor: "var(--brand-teal-600)",
      cursorColor: "var(--brand-navy-700)",
      barWidth: 3,
      barGap: 2,
      barRadius: 999,
    });

    wavesurferRef.current = wavesurfer;
    wavesurfer.on("ready", () => setReady(true));
    wavesurfer.on("play", () => setPlaying(true));
    wavesurfer.on("pause", () => setPlaying(false));
    wavesurfer.on("finish", () => setPlaying(false));

    return () => {
      wavesurfer.destroy();
      wavesurferRef.current = null;
    };
  }, [recordingUrl]);

  if (!recordingUrl) {
    return (
      <div className="rounded-xl border border-dashed border-border-default bg-bg-surface-sunken p-4 text-sm text-fg-tertiary">
        Recording will appear here after Retell finishes processing the call.
      </div>
    );
  }

  return (
    <div className="grid gap-3 rounded-xl border border-border-default bg-bg-surface p-4 shadow-xs">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold">Call recording</p>
          <p className="text-xs text-fg-tertiary">
            Loaded on demand so the chart opens quickly.
          </p>
        </div>
        <Button
          type="button"
          variant="accent"
          size="sm"
          disabled={!ready}
          onClick={() => void wavesurferRef.current?.playPause()}
        >
          {playing ? "Pause recording" : ready ? "Play recording" : "Loading recording..."}
        </Button>
      </div>
      <div ref={containerRef} className="overflow-hidden rounded-lg bg-bg-surface-sunken p-2" />
    </div>
  );
}
