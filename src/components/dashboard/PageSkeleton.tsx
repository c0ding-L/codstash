import { Skeleton } from "@/components/ui/skeleton";

const CARDS = ["a", "b", "c", "d", "e", "f"];

/** Shown from the moment a link is clicked until the page's data arrives. */
export function PageSkeleton() {
  return (
    <div className="flex flex-col gap-6" role="status" aria-label="Loading">
      <Skeleton className="h-8 w-48" />
      <div className="grid gap-4 md:grid-cols-2">
        {CARDS.map((key) => (
          <Skeleton key={key} className="h-24 rounded-xl" />
        ))}
      </div>
    </div>
  );
}
