import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

/** An item's tags as badges, in the drawer and under the tags input. */
export function TagBadges({ tags, className }: { tags: string[]; className?: string }) {
  return (
    <span className={cn("flex flex-wrap gap-1", className)}>
      {tags.map((tag) => (
        <Badge key={tag} variant="secondary">
          {tag}
        </Badge>
      ))}
    </span>
  );
}
