import { Star } from "lucide-react";
import Link from "next/link";

import { NewCollectionDialog } from "@/components/collections/NewCollectionDialog";
import { NewItemDialog } from "@/components/items/NewItemDialog";
import { CommandPalette } from "@/components/search/CommandPalette";
import { buttonVariants } from "@/components/ui/button";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { cn } from "@/lib/utils";

/**
 * Dashboard top bar. The search field opens the command palette, as does Cmd+K /
 * Ctrl+K. The trigger collapses the sidebar on desktop and opens the drawer on
 * mobile; "New Collection" and "New Item" open their create dialogs. The star
 * before them links to `/favorites`; its `ml-auto` pushes the three right.
 */
export function TopBar({ uploadsAllowed }: { uploadsAllowed: Promise<boolean> }) {
  return (
    <header className="flex h-14 shrink-0 items-center gap-3 border-b border-border px-4">
      <SidebarTrigger />

      <CommandPalette />

      <Link
        href="/favorites"
        aria-label="Favorites"
        title="Favorites"
        className={cn(buttonVariants({ variant: "ghost", size: "icon-lg" }), "ml-auto")}
      >
        <Star aria-hidden />
      </Link>
      <NewCollectionDialog />
      <NewItemDialog uploadsAllowed={uploadsAllowed} />
    </header>
  );
}
