"use client";

import { useOpenItemDrawer } from "@/components/items/ItemDrawerProvider";
import type { DashboardItem } from "@/lib/db/items";

/**
 * Covers its nearest positioned parent with one button. An overlay rather than a
 * wrapper because cards hold headings and paragraphs, which a button may not contain.
 */
export function ItemDrawerTrigger({ item }: { item: DashboardItem }) {
  const openItem = useOpenItemDrawer();

  return (
    <button
      type="button"
      aria-label={`Open ${item.title}`}
      onClick={() => openItem(item)}
      className="absolute inset-0 z-10 cursor-pointer rounded-[inherit] outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset"
    />
  );
}
