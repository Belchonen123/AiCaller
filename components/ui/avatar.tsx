"use client"

import * as React from "react"
import { Avatar as AvatarPrimitive } from "@base-ui/react/avatar"

import { cn } from "@/lib/utils"

const avatarPalette = [
  "bg-[oklch(0.42_0.08_240)]",
  "bg-[oklch(0.45_0.08_195)]",
  "bg-[oklch(0.44_0.02_240)]",
  "bg-[oklch(0.44_0.07_310)]",
  "bg-[oklch(0.50_0.09_75)]",
]

function hashString(value: string) {
  return Array.from(value).reduce((hash, char) => hash + char.charCodeAt(0), 0)
}

function initialsFrom(value: React.ReactNode) {
  return typeof value === "string" ? value.trim() : ""
}

function Avatar({
  className,
  size = "default",
  ...props
}: AvatarPrimitive.Root.Props & {
  size?: "xs" | "sm" | "default" | "md" | "lg" | "xl"
}) {
  return (
    <AvatarPrimitive.Root
      data-slot="avatar"
      data-size={size}
      className={cn(
        "group/avatar relative flex size-8 shrink-0 rounded-full select-none after:absolute after:inset-0 after:rounded-full after:border after:border-border-default data-[size=xs]:size-6 data-[size=sm]:size-8 data-[size=md]:size-10 data-[size=lg]:size-12 data-[size=xl]:size-16",
        className
      )}
      {...props}
    />
  )
}

function AvatarImage({ className, ...props }: AvatarPrimitive.Image.Props) {
  return (
    <AvatarPrimitive.Image
      data-slot="avatar-image"
      className={cn(
        "aspect-square size-full rounded-full object-cover",
        className
      )}
      {...props}
    />
  )
}

function AvatarFallback({
  className,
  children,
  ...props
}: AvatarPrimitive.Fallback.Props) {
  const seed = initialsFrom(children)
  const paletteClass = avatarPalette[hashString(seed) % avatarPalette.length]

  return (
    <AvatarPrimitive.Fallback
      data-slot="avatar-fallback"
      className={cn(
        "flex size-full items-center justify-center rounded-full text-sm font-medium text-fg-on-brand group-data-[size=xs]/avatar:text-xs group-data-[size=sm]/avatar:text-xs group-data-[size=lg]/avatar:text-base group-data-[size=xl]/avatar:text-xl",
        paletteClass,
        className
      )}
      {...props}
    >
      {children}
    </AvatarPrimitive.Fallback>
  )
}

function AvatarBadge({
  className,
  status = "online",
  ...props
}: React.ComponentProps<"span"> & {
  status?: "online" | "offline" | "busy"
}) {
  return (
    <span
      data-slot="avatar-badge"
      data-status={status}
      className={cn(
        "absolute right-0 bottom-0 z-10 inline-flex items-center justify-center rounded-full ring-2 ring-bg-surface select-none data-[status=busy]:bg-warning-fg data-[status=offline]:bg-fg-disabled data-[status=online]:bg-success-fg",
        "group-data-[size=sm]/avatar:size-2 group-data-[size=sm]/avatar:[&>svg]:hidden",
        "group-data-[size=default]/avatar:size-2.5 group-data-[size=default]/avatar:[&>svg]:size-2",
        "group-data-[size=md]/avatar:size-3 group-data-[size=md]/avatar:[&>svg]:size-2",
        "group-data-[size=lg]/avatar:size-3.5 group-data-[size=lg]/avatar:[&>svg]:size-2",
        "group-data-[size=xl]/avatar:size-4 group-data-[size=xl]/avatar:[&>svg]:size-2.5",
        className
      )}
      {...props}
    />
  )
}

function AvatarGroup({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="avatar-group"
      className={cn(
        "group/avatar-group flex -space-x-2 *:data-[slot=avatar]:ring-2 *:data-[slot=avatar]:ring-bg-surface",
        className
      )}
      {...props}
    />
  )
}

function AvatarGroupCount({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="avatar-group-count"
      className={cn(
        "relative flex size-8 shrink-0 items-center justify-center rounded-full bg-bg-muted text-sm font-medium text-fg-secondary ring-2 ring-bg-surface group-has-data-[size=lg]/avatar-group:size-12 group-has-data-[size=sm]/avatar-group:size-8 [&>svg]:size-4 group-has-data-[size=lg]/avatar-group:[&>svg]:size-5 group-has-data-[size=sm]/avatar-group:[&>svg]:size-3",
        className
      )}
      {...props}
    />
  )
}

export {
  Avatar,
  AvatarImage,
  AvatarFallback,
  AvatarGroup,
  AvatarGroupCount,
  AvatarBadge,
}
