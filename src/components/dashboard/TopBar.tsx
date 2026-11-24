import { Star } from "lucide-react";
import Link from "next/link";
import { Suspense } from "react";

import { NewCollectionDialog } from "@/components/collections/NewCollectionDialog";
import { UpgradeLink } from "@/components/dashboard/UpgradeLink";
import { NewItemDialog } from "@/components/items/NewItemDialog";
import { CommandPalette } from "@/components/search/CommandPalette";
import { buttonVariants } from "@/components/ui/button";
import { SidebarTrigger } from "@/components/ui/sidebar";

/**
 * Dashboard top bar. The search field opens the command palette, as does Cmd+K /
 * Ctrl+K. The trigger collapses the sidebar on desktop and opens the drawer on
 * mobile; "New Collection" and "New Item" open their create dialogs. The star
 * before them links to `/favorites`. Free users also get an Upgrade link first,
 * streamed in once the plan is read; the `ml-auto` group pushes them all right.
 */
export function TopBar({ uploadsAllowed, showUpgrade }: { uploadsAllowed: Promise<boolean>; showUpgrade: Promise<boolean> }) {
  return (
    <header className="flex h-14 shrink-0 items-center gap-3 border-b border-border px-4">
      <SidebarTrigger />

      <CommandPalette />

      <div className="ml-auto flex shrink-0 items-center gap-3">
        <Suspense fallback={null}>
          <UpgradeLink show={showUpgrade} />
        </Suspense>
        <Link
          href="/favorites"
          aria-label="Favorites"
          title="Favorites"
          className={buttonVariants({ variant: "ghost", size: "icon-lg" })}
        >
          <Star aria-hidden />
        </Link>
        <NewCollectionDialog />
        <NewItemDialog uploadsAllowed={uploadsAllowed} />
      </div>
    </header>
  );
}
