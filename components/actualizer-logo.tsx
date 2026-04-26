import { cn } from "@/lib/utils";

export function ActualizerLogo({
  className,
  markClassName,
  showText = true,
  variant = "wordmark",
  tagline = false,
}: {
  className?: string;
  markClassName?: string;
  showText?: boolean;
  variant?: "wordmark" | "mark" | "mono";
  tagline?: boolean;
}) {
  if (variant === "mono") {
    return (
      <span className={cn("font-heading text-sm font-semibold tracking-[0.04em] text-fg-primary", className)}>
        Actualizer
        {tagline ? <span className="ml-1 font-sans font-normal tracking-normal text-fg-tertiary">for healthcare</span> : null}
      </span>
    );
  }

  return (
    <div className={cn("inline-flex items-center gap-2", className)}>
      <ActualizerLogomark
        className={cn(
          "size-8",
          markClassName
        )}
      />
      {showText && variant !== "mark" ? (
        <span className="font-heading text-sm font-semibold tracking-[0.04em] text-fg-primary">
          Actualizer
          {tagline ? <span className="ml-1 font-sans font-normal tracking-normal text-fg-tertiary">for healthcare</span> : null}
        </span>
      ) : null}
    </div>
  );
}

export function ActualizerLogomark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 32 32"
      aria-hidden="true"
      className={cn("shrink-0 drop-shadow-sm", className)}
    >
      <defs>
        <linearGradient id="actualizer-mark-gradient" x1="6" y1="5" x2="26" y2="27">
          <stop stopColor="oklch(0.38 0.15 240)" />
          <stop offset="0.58" stopColor="oklch(0.30 0.13 240)" />
          <stop offset="1" stopColor="oklch(0.52 0.13 195)" />
        </linearGradient>
      </defs>
      <rect width="32" height="32" rx="9" fill="url(#actualizer-mark-gradient)" />
      <path
        d="M9 18.5 14.5 9l4.2 7.2 2.1-3.7L25 20H7l2-1.5Z"
        fill="white"
        fillOpacity="0.94"
      />
      <circle cx="22.5" cy="9.5" r="2.25" fill="oklch(0.72 0.12 195)" />
    </svg>
  );
}
