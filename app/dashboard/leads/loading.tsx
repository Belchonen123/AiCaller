import { Card } from "@/components/ui/card";
import { Skeleton, SkeletonGroup } from "@/components/ui/skeleton";

export default function LeadsLoading() {
  return (
    <SkeletonGroup className="grid gap-6">
      <div className="flex items-center justify-between border-b border-border-subtle pb-4">
        <div className="grid gap-2">
          <Skeleton size="text" className="w-24" />
          <Skeleton size="text-lg" className="w-32" />
          <Skeleton size="text" className="w-64" />
        </div>
        <Skeleton size="button" className="w-40" />
      </div>
      <section className="grid gap-3 md:grid-cols-5">
        {Array.from({ length: 5 }).map((_, index) => (
          <Card key={index} className="p-4">
            <Skeleton size="text" className="mb-3 w-24" />
            <Skeleton size="button" className="w-16" />
          </Card>
        ))}
      </section>
      <Card className="p-4">
        <Skeleton className="h-24 w-full" />
      </Card>
      <Card className="p-0">
        <div className="grid grid-cols-[2rem_7rem_7rem_18rem_14rem_8rem_8rem_9rem_9rem_10rem_5rem_4rem] gap-3 border-b border-border-subtle bg-bg-surface-sunken p-3">
          {Array.from({ length: 12 }).map((_, index) => (
            <Skeleton key={index} size="text" className="w-full" />
          ))}
        </div>
        {Array.from({ length: 8 }).map((_, index) => (
          <div
            key={index}
            className="grid grid-cols-[2rem_7rem_7rem_18rem_14rem_8rem_8rem_9rem_9rem_10rem_5rem_4rem] items-center gap-3 border-b border-border-subtle p-3"
          >
            <Skeleton className="size-4 rounded-sm" />
            <Skeleton size="button" className="w-20" />
            <Skeleton size="button" className="w-20" />
            <div className="flex items-center gap-3">
              <Skeleton className="size-8 rounded-full" />
              <div className="grid flex-1 gap-2">
                <Skeleton size="text" className="w-32" />
                <Skeleton size="text" className="w-44" />
              </div>
            </div>
            <div className="grid gap-2">
              <Skeleton size="text" className="w-28" />
              <Skeleton size="text" className="w-24" />
            </div>
            <div className="flex gap-1">
              {Array.from({ length: 6 }).map((__, cellIndex) => (
                <Skeleton key={cellIndex} className="h-2 w-3 rounded-sm" />
              ))}
            </div>
            <Skeleton size="button" className="w-20" />
            <Skeleton size="text" className="w-20" />
            <div className="grid gap-2">
              <Skeleton size="text" className="w-24" />
              <Skeleton size="text" className="w-16" />
            </div>
            <div className="flex items-center gap-2">
              <Skeleton className="size-8 rounded-full" />
              <Skeleton size="text" className="w-20" />
            </div>
            <Skeleton size="button" className="w-10" />
            <Skeleton className="size-8 rounded-md" />
          </div>
        ))}
      </Card>
    </SkeletonGroup>
  );
}
