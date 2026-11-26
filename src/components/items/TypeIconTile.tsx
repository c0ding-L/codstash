import { Clock, type LucideIcon } from "lucide-react";

import { colorClasses, surfaceClasses } from "@/lib/item-type-ui";
import { cn } from "@/lib/utils";
import type { ColorToken } from "@/types/item-type";

interface TypeIconTileProps {
  /** The type's icon (a `TypeView`'s `Icon`); null when there is no type. */
  icon: LucideIcon | null;
  color: ColorToken | null;
  /** The square's size and radius, and `shrink-0` where it sits in a flex row. */
  className?: string;
  /** The icon's size. */
  iconClassName?: string;
  /** Shown when there is no icon. */
  fallbackIcon?: LucideIcon;
  /** Without a colour, grey the icon instead of leaving it in the text colour. */
  mutedFallback?: boolean;
}

/**
 * A type's icon in its colour, on the colour's tint. Sizes stay with each caller:
 * the tile appears at several sizes, and Tailwind needs the classes written out.
 */
export function TypeIconTile({
  icon,
  color,
  className,
  iconClassName,
  fallbackIcon = Clock,
  mutedFallback = false,
}: TypeIconTileProps) {
  const Icon = icon ?? fallbackIcon;

  return (
    <span
      className={cn("flex items-center justify-center", color ? surfaceClasses[color] : "bg-muted", className)}
      aria-hidden
    >
      <Icon className={cn(iconClassName, color ? colorClasses[color] : mutedFallback && "text-muted-foreground")} />
    </span>
  );
}
