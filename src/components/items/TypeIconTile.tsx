import { Clock, type LucideIcon } from "lucide-react";

import { colorClasses, surfaceClasses, typeIcons } from "@/lib/item-type-ui";
import { cn } from "@/lib/utils";
import type { ColorToken, ItemTypeSlug } from "@/types/item-type";

interface TypeIconTileProps {
  slug: ItemTypeSlug | null;
  color: ColorToken | null;
  /** The square's size and radius, and `shrink-0` where it sits in a flex row. */
  className?: string;
  /** The icon's size. */
  iconClassName?: string;
  /** Shown when the slug is unknown. */
  fallbackIcon?: LucideIcon;
  /** Without a colour, grey the icon instead of leaving it in the text colour. */
  mutedFallback?: boolean;
}

/**
 * A type's icon in its colour, on the colour's tint. Sizes stay with each caller:
 * the tile appears at several sizes, and Tailwind needs the classes written out.
 */
export function TypeIconTile({
  slug,
  color,
  className,
  iconClassName,
  fallbackIcon = Clock,
  mutedFallback = false,
}: TypeIconTileProps) {
  const Icon = slug ? typeIcons[slug] : fallbackIcon;

  return (
    <span
      className={cn("flex items-center justify-center", color ? surfaceClasses[color] : "bg-muted", className)}
      aria-hidden
    >
      <Icon className={cn(iconClassName, color ? colorClasses[color] : mutedFallback && "text-muted-foreground")} />
    </span>
  );
}
