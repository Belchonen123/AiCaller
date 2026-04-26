"use client"

import * as React from "react"

import { cn } from "@/lib/utils"

function Table({
  className,
  zebra = false,
  stickyHeader = false,
  ...props
}: React.ComponentProps<"table"> & {
  zebra?: boolean
  stickyHeader?: boolean
}) {
  return (
    <div
      data-slot="table-container"
      data-sticky-header={stickyHeader || undefined}
      className="relative w-full overflow-x-auto rounded-lg border border-border-default bg-bg-surface"
    >
      <table
        data-slot="table"
        data-zebra={zebra || undefined}
        className={cn("w-full caption-bottom text-sm text-fg-primary", className)}
        {...props}
      />
    </div>
  )
}

function TableHeader({ className, ...props }: React.ComponentProps<"thead">) {
  return (
    <thead
      data-slot="table-header"
      className={cn("bg-bg-surface-sunken text-xs font-medium tracking-wide text-fg-tertiary uppercase [&_tr]:border-b [&_tr]:border-border-subtle in-data-[sticky-header=true]:sticky in-data-[sticky-header=true]:top-0 in-data-[sticky-header=true]:z-10", className)}
      {...props}
    />
  )
}

function TableBody({ className, ...props }: React.ComponentProps<"tbody">) {
  return (
    <tbody
      data-slot="table-body"
      className={cn("[&_tr:last-child]:border-0 in-data-[zebra=true]:[&_tr:nth-child(even)]:bg-bg-surface-sunken/60", className)}
      {...props}
    />
  )
}

function TableFooter({ className, ...props }: React.ComponentProps<"tfoot">) {
  return (
    <tfoot
      data-slot="table-footer"
      className={cn(
        "border-t border-border-subtle bg-bg-surface-sunken font-medium [&>tr]:last:border-b-0",
        className
      )}
      {...props}
    />
  )
}

function TableRow({
  className,
  compact = false,
  selected = false,
  ...props
}: React.ComponentProps<"tr"> & {
  compact?: boolean
  selected?: boolean
}) {
  return (
    <tr
      data-slot="table-row"
      data-compact={compact || undefined}
      data-selected={selected || undefined}
      className={cn(
        "group/row h-12 border-b border-border-subtle transition-colors duration-fast motion-reduce:transition-none hover:bg-bg-muted has-aria-expanded:bg-bg-muted data-[compact=true]:h-10 data-[selected=true]:bg-bg-emphasis data-[selected=true]:hover:bg-[var(--brand-navy-100)] data-[state=selected]:bg-bg-emphasis [&_.row-action]:opacity-0 [&_.row-action]:transition-opacity [&_.row-action]:duration-fast hover:[&_.row-action]:opacity-100 focus-within:[&_.row-action]:opacity-100",
        className
      )}
      {...props}
    />
  )
}

function TableHead({ className, ...props }: React.ComponentProps<"th">) {
  return (
    <th
      data-slot="table-head"
      className={cn(
        "h-10 px-3 text-left align-middle font-medium whitespace-nowrap text-fg-tertiary [&:has([role=checkbox])]:pr-0",
        className
      )}
      {...props}
    />
  )
}

function TableCell({ className, ...props }: React.ComponentProps<"td">) {
  return (
    <td
      data-slot="table-cell"
      className={cn(
        "px-3 py-2 align-middle whitespace-nowrap tabular-nums [&:has([role=checkbox])]:pr-0",
        className
      )}
      {...props}
    />
  )
}

function TableCaption({
  className,
  ...props
}: React.ComponentProps<"caption">) {
  return (
    <caption
      data-slot="table-caption"
      className={cn("mt-4 text-sm text-fg-tertiary", className)}
      {...props}
    />
  )
}

function TableEmpty({
  className,
  children,
  colSpan,
  ...props
}: React.ComponentProps<"td"> & { colSpan?: number }) {
  return (
    <tbody data-slot="table-empty">
      <tr>
        <td
          colSpan={colSpan}
          className={cn("h-40 text-center text-sm text-fg-tertiary", className)}
          {...props}
        >
          {children ?? "No records found."}
        </td>
      </tr>
    </tbody>
  )
}

export {
  Table,
  TableHeader,
  TableBody,
  TableFooter,
  TableHead,
  TableRow,
  TableCell,
  TableCaption,
  TableEmpty,
}
