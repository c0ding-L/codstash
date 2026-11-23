import { AppSidebar } from "@/components/dashboard/AppSidebar";
import { TopBar } from "@/components/dashboard/TopBar";
import { EditorPreferencesProvider } from "@/components/editor/EditorPreferencesContext";
import { ItemDrawerProvider } from "@/components/items/ItemDrawerProvider";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { TooltipProvider } from "@/components/ui/tooltip";
import { loadEditorPreferences } from "@/lib/load-editor-preferences";
import { loadUploadsAllowed } from "@/lib/load-uploads-allowed";

/**
 * App shell for every signed-in page (`/dashboard`, `/profile`, `/items`). `(app)` is a
 * route group, so it adds no URL segment. SidebarProvider owns the
 * collapsed/expanded state and swaps the sidebar for a drawer on mobile;
 * TooltipProvider is required by the tooltips SidebarMenuButton shows while
 * collapsed. ItemDrawerProvider holds the one item drawer, for the pages' cards
 * and the top bar's command palette alike. EditorPreferencesProvider gets the
 * user's Monaco settings as a promise, which each editor reads behind its own
 * Suspense boundary.
 *
 * `loading.tsx` sits below this layout, so nothing here may wait on data: that
 * would hold its fallback back. `AppSidebar` has its own boundary for that reason.
 */
export default function AppLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // Not awaited: the shell renders at once and the result streams in.
  const editorPreferences = loadEditorPreferences();
  // Free accounts cannot upload; the New Item dialog disables File and Image.
  const uploadsAllowed = loadUploadsAllowed();

  return (
    <EditorPreferencesProvider preferences={editorPreferences}>
      <TooltipProvider>
        <SidebarProvider>
          <AppSidebar />
          {/* `min-w-0`: a flex item otherwise grows to its widest content, and `truncate` inside never applies. */}
          <SidebarInset className="min-w-0">
            <ItemDrawerProvider>
              <TopBar uploadsAllowed={uploadsAllowed} />
              <div className="flex-1 p-6">{children}</div>
            </ItemDrawerProvider>
          </SidebarInset>
        </SidebarProvider>
      </TooltipProvider>
    </EditorPreferencesProvider>
  );
}
