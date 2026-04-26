import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { AlertCircleIcon, CheckCircle2Icon, InfoIcon, TriangleAlertIcon } from "lucide-react"

import { cn } from "@/lib/utils"

const alertVariants = cva(
  "group/alert relative grid w-full gap-1 rounded-lg border border-l-4 px-4 py-3 text-left text-sm has-data-[slot=alert-action]:pr-24 has-[>svg]:grid-cols-[auto_1fr] has-[>svg]:gap-x-3 *:[svg]:row-span-2 *:[svg]:mt-0.5 *:[svg]:size-4",
  {
    variants: {
      variant: {
        default: "border-info-border bg-info-bg text-info-fg",
        info: "border-info-border bg-info-bg text-info-fg",
        success: "border-success-border bg-success-bg text-success-fg",
        warning: "border-warning-border bg-warning-bg text-warning-fg",
        danger: "border-danger-border bg-danger-bg text-danger-fg",
        destructive: "border-danger-border bg-danger-bg text-danger-fg",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

function Alert({
  className,
  variant = "default",
  children,
  ...props
}: React.ComponentProps<"div"> & VariantProps<typeof alertVariants>) {
  const Icon =
    variant === "success"
      ? CheckCircle2Icon
      : variant === "warning"
        ? TriangleAlertIcon
        : variant === "danger" || variant === "destructive"
          ? AlertCircleIcon
          : InfoIcon

  return (
    <div
      data-slot="alert"
      role="alert"
      className={cn(alertVariants({ variant }), className)}
      {...props}
    >
      <Icon aria-hidden="true" />
      {children}
    </div>
  )
}

function AlertTitle({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="alert-title"
      className={cn(
        "font-medium group-has-[>svg]/alert:col-start-2 [&_a]:underline [&_a]:underline-offset-4",
        className
      )}
      {...props}
    />
  )
}

function AlertDescription({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="alert-description"
      className={cn(
        "text-sm text-balance opacity-90 md:text-pretty [&_a]:underline [&_a]:underline-offset-4 [&_p:not(:last-child)]:mb-4",
        className
      )}
      {...props}
    />
  )
}

function AlertAction({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="alert-action"
      className={cn("absolute top-2 right-2", className)}
      {...props}
    />
  )
}

export { Alert, AlertTitle, AlertDescription, AlertAction }
