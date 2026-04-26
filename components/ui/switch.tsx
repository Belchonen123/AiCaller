"use client"

import * as React from "react"

import { cn } from "@/lib/utils"

function Switch({
  className,
  ...props
}: Omit<React.ComponentProps<"input">, "type">) {
  return (
    <input
      type="checkbox"
      role="switch"
      data-slot="switch"
      className={cn(
        "peer h-6 w-10 shrink-0 cursor-pointer appearance-none rounded-full bg-neutral-300 p-0.5 outline-none transition-colors duration-base ease-out motion-reduce:transition-none checked:bg-accent-secondary focus-visible:shadow-focus disabled:cursor-not-allowed disabled:opacity-50 before:block before:size-5 before:rounded-full before:bg-bg-surface before:shadow-sm before:transition-transform before:duration-base before:ease-out checked:before:translate-x-4 motion-reduce:before:transition-none",
        className
      )}
      {...props}
    />
  )
}

function SwitchField({
  label,
  description,
  className,
  ...props
}: Omit<React.ComponentProps<"input">, "type"> & {
  label: React.ReactNode
  description?: React.ReactNode
}) {
  return (
    <label className={cn("flex items-start justify-between gap-3 text-sm", className)}>
      <span className="grid gap-1">
        <span className="font-medium leading-none text-fg-primary">{label}</span>
        {description ? (
          <span className="text-xs leading-normal text-fg-tertiary">{description}</span>
        ) : null}
      </span>
      <Switch {...props} />
    </label>
  )
}

export { Switch, SwitchField }
