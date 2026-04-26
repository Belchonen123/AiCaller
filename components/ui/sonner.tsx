"use client"

import { Toaster as Sonner, type ToasterProps } from "sonner"
import { CircleCheckIcon, InfoIcon, TriangleAlertIcon, OctagonXIcon, Loader2Icon } from "lucide-react"

const Toaster = ({ ...props }: ToasterProps) => {
  return (
    <Sonner
      theme="system"
      className="toaster group"
      position="bottom-right"
      mobileOffset={12}
      icons={{
        success: (
          <CircleCheckIcon className="size-4" />
        ),
        info: (
          <InfoIcon className="size-4" />
        ),
        warning: (
          <TriangleAlertIcon className="size-4" />
        ),
        error: (
          <OctagonXIcon className="size-4" />
        ),
        loading: (
          <Loader2Icon className="size-4 animate-spin" />
        ),
      }}
      style={
        {
          "--normal-bg": "var(--popover)",
          "--normal-text": "var(--popover-foreground)",
          "--normal-border": "var(--border)",
          "--success-bg": "var(--color-success-bg)",
          "--success-text": "var(--color-success-fg)",
          "--warning-bg": "var(--color-warning-bg)",
          "--warning-text": "var(--color-warning-fg)",
          "--error-bg": "var(--color-danger-bg)",
          "--error-text": "var(--color-danger-fg)",
          "--border-radius": "var(--radius-lg)",
        } as React.CSSProperties
      }
      toastOptions={{
        classNames: {
          toast:
            "cn-toast !rounded-lg !border-border-default !bg-bg-surface-raised !text-fg-primary !shadow-lg data-[mounted=true]:!animate-in data-[mounted=true]:!fade-in-0 data-[mounted=true]:!slide-in-from-bottom-2 motion-reduce:!duration-0",
          title: "!font-medium !text-fg-primary",
          description: "!text-fg-tertiary",
          success: "!border-success-border",
          warning: "!border-warning-border",
          error: "!border-danger-border",
          info: "!border-info-border",
        },
      }}
      {...props}
    />
  )
}

export { Toaster }
