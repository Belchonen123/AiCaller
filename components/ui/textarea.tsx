import * as React from "react"

import { cn } from "@/lib/utils"
import { Label } from "@/components/ui/label"

type TextareaProps = React.ComponentProps<"textarea"> & {
  label?: React.ReactNode
  description?: React.ReactNode
  error?: React.ReactNode
}

function Textarea({
  className,
  label,
  description,
  error,
  id,
  "aria-invalid": ariaInvalid,
  ...props
}: TextareaProps) {
  const generatedId = React.useId()
  const textareaId = id ?? generatedId
  const invalid = Boolean(error) || ariaInvalid === true || ariaInvalid === "true"
  const textarea = (
    <textarea
      id={textareaId}
      data-slot="textarea"
      aria-invalid={invalid || undefined}
      className={cn(
        "flex min-h-20 w-full rounded-md border border-border-default bg-bg-surface px-2.5 py-2 text-sm text-fg-primary shadow-[inset_0_1px_1px_rgb(15_23_42_/_0.04)] outline-none transition-colors duration-fast ease-out placeholder:text-fg-tertiary motion-reduce:transition-none focus-visible:border-border-emphasis focus-visible:shadow-focus disabled:cursor-not-allowed disabled:bg-bg-muted disabled:text-fg-disabled data-[invalid=true]:border-danger-border aria-invalid:border-danger-border aria-invalid:focus-visible:shadow-[0_0_0_4px_color-mix(in_oklch,var(--color-danger-border)_24%,transparent)]",
        className
      )}
      {...props}
    />
  )

  if (!label && !description && !error) {
    return textarea
  }

  return (
    <div data-slot="textarea-field" className="grid gap-1.5">
      {label ? <Label htmlFor={textareaId}>{label}</Label> : null}
      {textarea}
      {description && !error ? (
        <p className="text-xs leading-normal text-fg-tertiary">{description}</p>
      ) : null}
      {error ? <p className="text-xs leading-normal text-danger-fg">{error}</p> : null}
    </div>
  )
}

export { Textarea }
