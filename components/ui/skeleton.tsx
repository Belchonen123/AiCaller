import { cn } from "@/lib/utils"

function Skeleton({
  className,
  size = "text",
  ...props
}: React.ComponentProps<"div"> & {
  size?: "text" | "text-lg" | "button" | "input"
}) {
  return (
    <div
      data-slot="skeleton"
      data-size={size}
      className={cn(
        "animate-pulse rounded-md bg-bg-muted motion-reduce:animate-none data-[size=button]:h-8 data-[size=input]:h-10 data-[size=text-lg]:h-6 data-[size=text]:h-4",
        className
      )}
      {...props}
    />
  )
}

function SkeletonGroup({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="skeleton-group"
      className={cn(
        "grid gap-2 [&>*:nth-child(2)]:[animation-delay:50ms] [&>*:nth-child(3)]:[animation-delay:100ms] [&>*:nth-child(4)]:[animation-delay:150ms] [&>*:nth-child(5)]:[animation-delay:200ms]",
        className
      )}
      {...props}
    />
  )
}

export { Skeleton, SkeletonGroup }
