import { Search } from "lucide-react";

import { NewItemDialog } from "@/components/items/NewItemDialog";
import { Input } from "@/components/ui/input";
import { SidebarTrigger } from "@/components/ui/sidebar";

/**
 * Dashboard top bar. Search is display only. The trigger collapses the sidebar
 * on desktop and opens the drawer on mobile; "New Item" opens the create dialog.
 */
export function TopBar() {
  return (
    <header className="flex h-14 shrink-0 items-center gap-3 border-b border-border px-4">
      <SidebarTrigger />

      <div className="relative w-full max-w-md">
        <Search
          className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground"
          aria-hidden
        />
        <Input
          type="search"
          placeholder="Search collections and items…"
          aria-label="Search collections and items"
          className="h-9 pl-8"
        />
      </div>

      <NewItemDialog />
    </header>
  );
}
