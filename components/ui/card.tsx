import * as React from "react"

import { cn } from "@/lib/utils"

function Card({
  className,
  size = "default",
  padding = "padded",
  elevation = "default",
  interactive = false,
  ...props
}: React.ComponentProps<"div"> & {
  size?: "default" | "sm"
  padding?: "compact" | "padded" | "comfortable"
  elevation?: "default" | "raised"
  interactive?: boolean
}) {
  return (
    <div
      data-slot="card"
      data-size={size}
      data-padding={padding}
      data-elevation={elevation}
      data-interactive={interactive || undefined}
      className={cn(
        "group/card flex flex-col gap-4 overflow-hidden rounded-lg bg-bg-surface text-sm text-fg-primary shadow-xs transition-[box-shadow,border-color,transform] duration-fast ease-out motion-reduce:transition-none motion-reduce:transform-none data-[elevation=default]:border data-[elevation=default]:border-border-default data-[elevation=raised]:border-0 data-[elevation=raised]:shadow-md data-[interactive=true]:cursor-pointer data-[interactive=true]:hover:-translate-y-0.5 data-[interactive=true]:hover:border-border-strong data-[interactive=true]:hover:shadow-md data-[padding=compact]:p-4 data-[padding=padded]:p-6 data-[padding=comfortable]:p-8 data-[size=sm]:gap-3 *:[img:first-child]:rounded-t-lg *:[img:last-child]:rounded-b-lg",
        className
      )}
      {...props}
    />
  )
}

function CardHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-header"
      className={cn(
        "group/card-header @container/card-header grid auto-rows-min items-start gap-1 has-data-[slot=card-action]:grid-cols-[1fr_auto] has-data-[slot=card-description]:grid-rows-[auto_auto]",
        className
      )}
      {...props}
    />
  )
}

function CardTitle({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-title"
      className={cn(
        "font-heading text-lg leading-snug font-semibold tracking-snug text-fg-primary group-data-[size=sm]/card:text-base",
        className
      )}
      {...props}
    />
  )
}

function CardDescription({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-description"
      className={cn("text-sm leading-normal text-fg-tertiary", className)}
      {...props}
    />
  )
}

function CardAction({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-action"
      className={cn(
        "col-start-2 row-span-2 row-start-1 self-start justify-self-end",
        className
      )}
      {...props}
    />
  )
}

function CardContent({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-content"
      className={cn("text-fg-primary", className)}
      {...props}
    />
  )
}

function CardFooter({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-footer"
      className={cn(
        "flex items-center gap-2 border-t border-border-subtle pt-4",
        className
      )}
      {...props}
    />
  )
}

export {
  Card,
  CardHeader,
  CardFooter,
  CardTitle,
  CardAction,
  CardDescription,
  CardContent,
}
