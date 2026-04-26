"use client"

import * as React from "react"
import { Checkbox as CheckboxPrimitive } from "@base-ui/react/checkbox"

import { cn } from "@/lib/utils"
import { CheckIcon } from "lucide-react"

function Checkbox({ className, ...props }: CheckboxPrimitive.Root.Props) {
  return (
    <CheckboxPrimitive.Root
      data-slot="checkbox"
      className={cn(
        "peer relative flex size-4 shrink-0 items-center justify-center rounded-sm border border-border-strong bg-bg-surface text-fg-on-brand outline-none transition-colors duration-fast motion-reduce:transition-none after:absolute after:-inset-x-3 after:-inset-y-2 focus-visible:shadow-focus disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-danger-border data-checked:border-accent-primary data-checked:bg-accent-primary group-has-disabled/field:opacity-50",
        className
      )}
      {...props}
    >
      <CheckboxPrimitive.Indicator
        data-slot="checkbox-indicator"
        className="grid place-content-center text-current transition-none [&>svg]:size-3.5"
      >
        <CheckIcon
        />
      </CheckboxPrimitive.Indicator>
    </CheckboxPrimitive.Root>
  )
}

function CheckboxField({
  label,
  description,
  className,
  id,
  ...props
}: CheckboxPrimitive.Root.Props & {
  label: React.ReactNode
  description?: React.ReactNode
}) {
  const generatedId = React.useId()
  const checkboxId = id ?? generatedId

  return (
    <label className={cn("group/field flex items-start gap-3 text-sm", className)}>
      <Checkbox id={checkboxId} {...props} />
      <span className="grid gap-1">
        <span className="font-medium leading-none text-fg-primary">{label}</span>
        {description ? (
          <span className="text-xs leading-normal text-fg-tertiary">{description}</span>
        ) : null}
      </span>
    </label>
  )
}

export { Checkbox, CheckboxField }
