import type { ReactNode } from "react"
import { isValidElement } from "react"
import { Button as ButtonPrimitive } from "@base-ui/react/button"
import { cva, type VariantProps } from "class-variance-authority"
import { Loader2Icon } from "lucide-react"

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "group/button inline-flex shrink-0 items-center justify-center gap-2 rounded-md border border-transparent bg-clip-padding text-sm font-medium whitespace-nowrap outline-none select-none transition-all duration-fast ease-out motion-reduce:transition-none motion-reduce:transform-none focus-visible:shadow-focus active:not-aria-[haspopup]:translate-y-px active:not-aria-[haspopup]:scale-[0.98] disabled:pointer-events-none disabled:cursor-not-allowed disabled:translate-y-0 disabled:scale-100 disabled:opacity-55 aria-invalid:border-danger-border aria-invalid:shadow-focus [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        default:
          "bg-accent-primary text-fg-on-brand shadow-sm hover:bg-accent-primary-hover hover:shadow-md active:bg-[var(--brand-navy-700)]",
        primary:
          "bg-accent-primary text-fg-on-brand shadow-sm hover:bg-accent-primary-hover hover:shadow-md active:bg-[var(--brand-navy-700)]",
        outline:
          "border-border-strong bg-bg-surface text-fg-link shadow-xs hover:bg-bg-muted hover:text-fg-link-hover aria-expanded:bg-bg-muted",
        secondary:
          "border-border-strong bg-bg-surface text-fg-link shadow-xs hover:bg-bg-muted hover:text-fg-link-hover aria-expanded:bg-bg-muted",
        ghost:
          "bg-transparent text-fg-link hover:bg-bg-muted hover:text-fg-link-hover aria-expanded:bg-bg-muted",
        tertiary:
          "bg-transparent text-fg-link hover:bg-bg-muted hover:text-fg-link-hover aria-expanded:bg-bg-muted",
        destructive:
          "bg-danger-fg text-fg-on-brand shadow-sm hover:brightness-95 hover:shadow-md active:brightness-90",
        accent:
          "bg-accent-secondary text-fg-on-brand shadow-sm hover:bg-accent-secondary-hover hover:shadow-md active:brightness-90",
        link: "h-auto rounded-sm border-0 bg-transparent px-0 text-fg-link shadow-none underline-offset-4 hover:text-fg-link-hover hover:underline",
      },
      size: {
        default: "h-9 px-3",
        md: "h-9 px-3",
        xs: "h-7 gap-1.5 px-2 text-xs [&_svg:not([class*='size-'])]:size-3.5",
        sm: "h-8 gap-1.5 px-2.5 text-sm [&_svg:not([class*='size-'])]:size-3.5",
        lg: "h-10 px-4",
        xl: "h-11 px-5 text-base",
        icon: "size-9 p-0",
        "icon-xs": "size-7 p-0 [&_svg:not([class*='size-'])]:size-3.5",
        "icon-sm": "size-8 p-0",
        "icon-lg": "size-10 p-0",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

function Button({
  className,
  variant = "default",
  size = "default",
  loading = false,
  iconLeft,
  iconRight,
  children,
  disabled,
  ...props
}: ButtonPrimitive.Props &
  VariantProps<typeof buttonVariants> & {
    loading?: boolean
    iconLeft?: ReactNode
    iconRight?: ReactNode
  }) {
  const renderProp = props.render
  const rendersNativeButton =
    isValidElement(renderProp) &&
    typeof renderProp.type === "string" &&
    renderProp.type === "button"
  const nativeButton =
    props.nativeButton ?? (renderProp ? rendersNativeButton : undefined)

  return (
    <ButtonPrimitive
      data-slot="button"
      className={cn(buttonVariants({ variant, size, className }))}
      disabled={disabled || loading}
      nativeButton={nativeButton}
      {...props}
    >
      {loading ? <Loader2Icon className="size-4 animate-spin" /> : iconLeft}
      {loading ? <span className="sr-only">Loading</span> : children}
      {!loading ? iconRight : null}
    </ButtonPrimitive>
  )
}

export { Button, buttonVariants }
