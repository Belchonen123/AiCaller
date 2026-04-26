import * as React from "react"
import { Input as InputPrimitive } from "@base-ui/react/input"

import { cn } from "@/lib/utils"
import { Label } from "@/components/ui/label"

type InputProps = Omit<React.ComponentProps<"input">, "prefix"> & {
  label?: React.ReactNode
  description?: React.ReactNode
  error?: React.ReactNode
  prefix?: React.ReactNode
  suffix?: React.ReactNode
}

function Input({
  className,
  type,
  label,
  description,
  error,
  prefix,
  suffix,
  id,
  "aria-invalid": ariaInvalid,
  ...props
}: InputProps) {
  const generatedId = React.useId()
  const inputId = id ?? generatedId
  const invalid = Boolean(error) || ariaInvalid === true || ariaInvalid === "true"
  const input = (
    <div
      data-slot="input-wrapper"
      data-invalid={invalid || undefined}
      className={cn(
        "group/input flex h-9 w-full min-w-0 items-center gap-2 rounded-md border border-border-default bg-bg-surface px-2.5 py-1 text-sm text-fg-primary shadow-[inset_0_1px_1px_rgb(15_23_42_/_0.04)] transition-colors duration-fast ease-out motion-reduce:transition-none focus-within:border-border-emphasis focus-within:shadow-focus data-[invalid=true]:border-danger-border data-[invalid=true]:focus-within:shadow-[0_0_0_4px_color-mix(in_oklch,var(--color-danger-border)_24%,transparent)] has-disabled:cursor-not-allowed has-disabled:bg-bg-muted has-disabled:text-fg-disabled",
        className
      )}
    >
      {prefix ? <span className="shrink-0 text-fg-tertiary">{prefix}</span> : null}
      <InputPrimitive
        id={inputId}
        type={type}
        data-slot="input"
        aria-invalid={invalid || undefined}
        className="h-full min-w-0 flex-1 border-0 bg-transparent p-0 text-sm outline-none placeholder:text-fg-tertiary disabled:cursor-not-allowed disabled:text-fg-disabled file:inline-flex file:h-6 file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-fg-primary"
        {...props}
      />
      {suffix ? <span className="shrink-0 text-fg-tertiary">{suffix}</span> : null}
    </div>
  )

  if (!label && !description && !error) {
    return input
  }

  return (
    <div data-slot="input-field" className="grid gap-1.5">
      {label ? <Label htmlFor={inputId}>{label}</Label> : null}
      {input}
      {description && !error ? (
        <p className="text-xs leading-normal text-fg-tertiary">{description}</p>
      ) : null}
      {error ? <p className="text-xs leading-normal text-danger-fg">{error}</p> : null}
    </div>
  )
}

export { Input }
