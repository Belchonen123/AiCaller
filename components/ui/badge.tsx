"use client"

import type { ReactNode } from "react"
import { mergeProps } from "@base-ui/react/merge-props"
import { useRender } from "@base-ui/react/use-render"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const badgeVariants = cva(
  "group/badge inline-flex w-fit shrink-0 items-center justify-center gap-1.5 overflow-hidden rounded-full border px-2 font-medium whitespace-nowrap transition-colors duration-fast motion-reduce:transition-none focus-visible:shadow-focus [&>svg]:pointer-events-none [&>svg]:shrink-0",
  {
    variants: {
      variant: {
        default: "",
        neutral: "",
        brand: "",
        accent: "",
        success: "",
        warning: "",
        danger: "",
        destructive: "",
        info: "",
        emergent: "",
        urgent: "",
        routine: "",
        informational: "",
        secondary: "",
        outline: "",
        ghost: "",
        link: "",
      },
      tone: {
        subtle: "",
        solid: "",
      },
      size: {
        xs: "h-5 text-xs [&>svg]:size-3",
        sm: "h-6 text-xs [&>svg]:size-3.5",
        md: "h-7 text-sm [&>svg]:size-4",
      },
    },
    compoundVariants: [
      { variant: ["default", "brand"], tone: "subtle", className: "border-border-emphasis bg-bg-emphasis text-fg-on-emphasis" },
      { variant: ["default", "brand"], tone: "solid", className: "border-accent-primary bg-accent-primary text-fg-on-brand" },
      { variant: ["neutral", "secondary", "outline", "ghost"], tone: "subtle", className: "border-border-default bg-bg-muted text-fg-secondary" },
      { variant: ["neutral", "secondary", "outline", "ghost"], tone: "solid", className: "border-fg-secondary bg-fg-secondary text-fg-on-brand" },
      { variant: "accent", tone: "subtle", className: "border-[color-mix(in_oklch,var(--color-accent-secondary)_35%,transparent)] bg-[color-mix(in_oklch,var(--color-accent-secondary)_12%,transparent)] text-[var(--brand-teal-700)]" },
      { variant: "accent", tone: "solid", className: "border-accent-secondary bg-accent-secondary text-fg-on-brand" },
      { variant: "success", tone: "subtle", className: "border-success-border bg-success-bg text-success-fg" },
      { variant: "success", tone: "solid", className: "border-success-fg bg-success-fg text-fg-on-brand" },
      { variant: "warning", tone: "subtle", className: "border-warning-border bg-warning-bg text-warning-fg" },
      { variant: "warning", tone: "solid", className: "border-warning-fg bg-warning-fg text-fg-on-brand" },
      { variant: ["danger", "destructive"], tone: "subtle", className: "border-danger-border bg-danger-bg text-danger-fg" },
      { variant: ["danger", "destructive"], tone: "solid", className: "border-danger-fg bg-danger-fg text-fg-on-brand" },
      { variant: "info", tone: "subtle", className: "border-info-border bg-info-bg text-info-fg" },
      { variant: "info", tone: "solid", className: "border-info-fg bg-info-fg text-fg-on-brand" },
      { variant: "emergent", tone: "subtle", className: "border-[color-mix(in_oklch,var(--color-urgency-emergent)_40%,transparent)] bg-[color-mix(in_oklch,var(--color-urgency-emergent)_12%,transparent)] text-urgency-emergent" },
      { variant: "emergent", tone: "solid", className: "border-urgency-emergent bg-urgency-emergent text-fg-on-brand" },
      { variant: "urgent", tone: "subtle", className: "border-[color-mix(in_oklch,var(--color-urgency-urgent)_45%,transparent)] bg-[color-mix(in_oklch,var(--color-urgency-urgent)_14%,transparent)] text-urgency-urgent" },
      { variant: "urgent", tone: "solid", className: "border-urgency-urgent bg-urgency-urgent text-fg-primary" },
      { variant: "routine", tone: "subtle", className: "border-[color-mix(in_oklch,var(--color-urgency-routine)_35%,transparent)] bg-bg-emphasis text-urgency-routine" },
      { variant: "routine", tone: "solid", className: "border-urgency-routine bg-urgency-routine text-fg-on-brand" },
      { variant: "informational", tone: "subtle", className: "border-border-default bg-bg-muted text-urgency-informational" },
      { variant: "informational", tone: "solid", className: "border-urgency-informational bg-urgency-informational text-fg-on-brand" },
      { variant: "link", tone: ["subtle", "solid"], className: "border-transparent bg-transparent px-0 text-fg-link underline-offset-4 hover:underline" },
    ],
    defaultVariants: {
      variant: "default",
      tone: "subtle",
      size: "sm",
    },
  }
)

const dotVariants = cva("size-1.5 shrink-0 rounded-full", {
  variants: {
    variant: {
      default: "bg-accent-primary",
      neutral: "bg-fg-tertiary",
      brand: "bg-accent-primary",
      accent: "bg-accent-secondary",
      success: "bg-success-fg",
      warning: "bg-warning-fg",
      danger: "bg-danger-fg",
      destructive: "bg-danger-fg",
      info: "bg-info-fg",
      emergent: "bg-urgency-emergent",
      urgent: "bg-urgency-urgent",
      routine: "bg-urgency-routine",
      informational: "bg-urgency-informational",
      secondary: "bg-fg-tertiary",
      outline: "bg-fg-tertiary",
      ghost: "bg-fg-tertiary",
      link: "bg-fg-link",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

function Badge({
  className,
  variant = "default",
  tone = "subtle",
  size = "sm",
  dot = false,
  withIcon,
  children,
  render,
  ...props
}: useRender.ComponentProps<"span"> &
  VariantProps<typeof badgeVariants> & {
    dot?: boolean
    withIcon?: ReactNode
  }) {
  const activeStatus =
    typeof children === "string" && ["running", "in_progress"].includes(children)

  return useRender({
    defaultTagName: "span",
    props: mergeProps<"span">(
      {
        className: cn(badgeVariants({ variant, tone, size }), className),
        children: (
          <>
            {dot ? <span aria-hidden="true" className={cn(dotVariants({ variant }), activeStatus && "animate-pulse")} /> : null}
            {withIcon}
            {children}
          </>
        ),
      },
      props
    ),
    render,
    state: {
      slot: "badge",
      variant,
      tone,
      size,
    },
  })
}

export { Badge, badgeVariants }
