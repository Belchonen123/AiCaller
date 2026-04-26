import { Card } from "@/components/ui/card";
import { Skeleton, SkeletonGroup } from "@/components/ui/skeleton";

export default function DashboardLoading() {
  return (
    <SkeletonGroup className="grid gap-6">
      <div className="flex items-center justify-between border-b border-border-subtle pb-4">
        <div className="grid gap-2">
          <Skeleton size="text" className="w-24" />
          <Skeleton size="text-lg" className="w-48" />
          <Skeleton size="text" className="w-72" />
        </div>
        <Skeleton size="button" className="w-32" />
      </div>
      <section className="grid gap-3 md:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <Card key={index} className="p-4">
            <Skeleton size="text" className="mb-3 w-24" />
            <Skeleton size="button" className="w-16" />
          </Card>
        ))}
      </section>
      <Card className="p-4">
        <Skeleton size="input" className="mb-4 w-full" />
        <div className="grid gap-3">
          {Array.from({ length: 8 }).map((_, index) => (
            <Skeleton key={index} size="button" className="w-full" />
          ))}
        </div>
      </Card>
    </SkeletonGroup>
  );
}
