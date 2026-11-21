import { NewCollectionDialog } from "@/components/collections/NewCollectionDialog";
import { NewItemDialog } from "@/components/items/NewItemDialog";
import { CommandPalette } from "@/components/search/CommandPalette";
import { SidebarTrigger } from "@/components/ui/sidebar";

/**
 * Dashboard top bar. The search field opens the command palette, as does Cmd+K /
 * Ctrl+K. The trigger collapses the sidebar on desktop and opens the drawer on
 * mobile; "New Collection" and "New Item" open their create dialogs.
 */
export function TopBar() {
  return (
    <header className="flex h-14 shrink-0 items-center gap-3 border-b border-border px-4">
      <SidebarTrigger />

      <CommandPalette />

      <NewCollectionDialog />
      <NewItemDialog />
    </header>
  );
}
