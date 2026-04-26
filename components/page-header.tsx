import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

type PageHeaderProps = {
  eyebrow?: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  tabs?: ReactNode;
  className?: string;
};

export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
  tabs,
  className,
}: PageHeaderProps) {
  return (
    <header className={cn("mb-6 border-b border-border-subtle pb-4", className)}>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          {eyebrow ? (
            <p className="mb-1 text-xs font-medium tracking-wide text-fg-tertiary uppercase">
              {eyebrow}
            </p>
          ) : null}
          <h1 className="font-heading text-xl font-semibold tracking-snug text-fg-primary">
            {title}
          </h1>
          {description ? (
            <p className="mt-1 max-w-3xl text-sm leading-normal text-fg-secondary">
              {description}
            </p>
          ) : null}
        </div>
        {actions ? <div className="flex shrink-0 flex-wrap gap-2">{actions}</div> : null}
      </div>
      {tabs ? <div className="mt-4">{tabs}</div> : null}
    </header>
  );
}
