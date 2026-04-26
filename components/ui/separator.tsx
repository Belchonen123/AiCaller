"use client"

import { Separator as SeparatorPrimitive } from "@base-ui/react/separator"

import { cn } from "@/lib/utils"

function Separator({
  className,
  orientation = "horizontal",
  label,
  ...props
}: SeparatorPrimitive.Props & { label?: React.ReactNode }) {
  if (label && orientation === "horizontal") {
    return (
      <div data-slot="separator-label" className={cn("flex items-center gap-3", className)}>
        <SeparatorPrimitive
          orientation="horizontal"
          className="h-px flex-1 bg-border-subtle"
          {...props}
        />
        <span className="text-xs font-medium tracking-wide text-fg-tertiary uppercase">{label}</span>
        <SeparatorPrimitive orientation="horizontal" className="h-px flex-1 bg-border-subtle" />
      </div>
    )
  }

  return (
    <SeparatorPrimitive
      data-slot="separator"
      orientation={orientation}
      className={cn(
        "shrink-0 bg-border-subtle data-horizontal:h-px data-horizontal:w-full data-vertical:w-px data-vertical:self-stretch",
        className
      )}
      {...props}
    />
  )
}

export { Separator }
