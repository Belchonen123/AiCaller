import { TrendingDownIcon, TrendingUpIcon } from "lucide-react";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

type StatCardProps = {
  label: string;
  value: string | number;
  delta?: string;
  trend?: "up" | "down" | "neutral";
  comparisonLabel?: string;
  sparkline?: number[];
  tone?: "default" | "danger" | "warning";
  valueClassName?: string;
};

function sparklinePoints(values: number[]) {
  const safeValues = values.length ? values : [0, 0, 0, 0, 0, 0, 0];
  const max = Math.max(...safeValues, 1);
  const step = 80 / Math.max(safeValues.length - 1, 1);

  return safeValues
    .map((value, index) => `${index * step},${24 - (value / max) * 20 - 2}`)
    .join(" ");
}

export function StatCard({
  label,
  value,
  delta,
  trend = "neutral",
  comparisonLabel = "vs prior 7d",
  sparkline = [2, 4, 3, 5, 6, 4, 7],
  tone = "default",
  valueClassName,
}: StatCardProps) {
  const TrendIcon = trend === "neutral" ? null : trend === "up" ? TrendingUpIcon : TrendingDownIcon;

  return (
    <Card
      elevation="raised"
      padding="compact"
      className={cn(
        "min-w-0 gap-3",
        tone === "danger" && "bg-danger-bg",
        tone === "warning" && "bg-warning-bg"
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-xs font-medium tracking-wide text-fg-tertiary uppercase">
            {label}
          </p>
          <p
            className={cn(
              "mt-1 text-2xl font-semibold tabular-nums text-fg-primary",
              tone === "danger" && "text-danger-fg",
              tone === "warning" && "text-warning-fg",
              valueClassName
            )}
          >
            {value}
          </p>
        </div>
        <svg
          width="80"
          height="24"
          viewBox="0 0 80 24"
          aria-hidden="true"
          className="mt-1 shrink-0"
        >
          <polyline
            fill="none"
            stroke="var(--brand-navy-300)"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="2"
            points={sparklinePoints(sparkline)}
          />
        </svg>
      </div>
      <p
        className={cn(
          "flex items-center gap-1 text-xs font-medium",
          trend === "up" && "text-success-fg",
          trend === "down" && "text-danger-fg",
          trend === "neutral" && "text-fg-secondary"
        )}
      >
        {TrendIcon ? <TrendIcon className="size-3.5" /> : null}
        {delta ? `${delta} ${comparisonLabel}` : comparisonLabel}
      </p>
    </Card>
  );
}
