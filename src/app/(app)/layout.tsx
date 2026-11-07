import { AppSidebar } from "@/components/dashboard/AppSidebar";
import { TopBar } from "@/components/dashboard/TopBar";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { TooltipProvider } from "@/components/ui/tooltip";

/**
 * App shell for every signed-in page (`/dashboard`, `/profile`, `/items`). `(app)` is a
 * route group, so it adds no URL segment. SidebarProvider owns the
 * collapsed/expanded state and swaps the sidebar for a drawer on mobile;
 * TooltipProvider is required by the tooltips SidebarMenuButton shows while
 * collapsed.
 *
 * `loading.tsx` sits below this layout, so nothing here may wait on data: that
 * would hold its fallback back. `AppSidebar` has its own boundary for that reason.
 */
export default function AppLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <TooltipProvider>
      <SidebarProvider>
        <AppSidebar />
        <SidebarInset>
          <TopBar />
          <div className="flex-1 p-6">{children}</div>
        </SidebarInset>
      </SidebarProvider>
    </TooltipProvider>
  );
}
