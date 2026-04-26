"use client"

import * as React from "react"

import { cn } from "@/lib/utils"

function RadioGroup({ className, ...props }: React.ComponentProps<"div">) {
  return <div data-slot="radio-group" className={cn("grid gap-2", className)} {...props} />
}

function RadioGroupItem({
  className,
  ...props
}: Omit<React.ComponentProps<"input">, "type">) {
  return (
    <input
      type="radio"
      data-slot="radio-group-item"
      className={cn(
        "size-4 shrink-0 appearance-none rounded-full border border-border-strong bg-bg-surface outline-none transition-colors duration-fast motion-reduce:transition-none checked:border-accent-primary checked:bg-[radial-gradient(circle_at_center,var(--color-accent-primary)_0_38%,transparent_42%)] focus-visible:shadow-focus disabled:cursor-not-allowed disabled:opacity-50",
        className
      )}
      {...props}
    />
  )
}

function RadioField({
  label,
  description,
  className,
  ...props
}: Omit<React.ComponentProps<"input">, "type"> & {
  label: React.ReactNode
  description?: React.ReactNode
}) {
  return (
    <label className={cn("group/field flex items-start gap-3 text-sm", className)}>
      <RadioGroupItem {...props} />
      <span className="grid gap-1">
        <span className="font-medium leading-none text-fg-primary">{label}</span>
        {description ? (
          <span className="text-xs leading-normal text-fg-tertiary">{description}</span>
        ) : null}
      </span>
    </label>
  )
}

export { RadioGroup, RadioGroupItem, RadioField }
