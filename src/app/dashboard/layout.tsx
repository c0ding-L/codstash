import { TopBar } from "@/components/dashboard/TopBar";

/**
 * Dashboard shell: top bar across the width, sidebar beside the main area.
 * The sidebar is a placeholder until phase 2.
 */
export default function DashboardLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <div className="flex min-h-svh flex-1 flex-col bg-background text-foreground">
      <TopBar />

      <div className="flex flex-1">
        <aside className="w-64 shrink-0 border-r border-border bg-sidebar p-4">
          <h2 className="text-sm font-medium text-muted-foreground">Sidebar</h2>
        </aside>

        <main className="flex-1 p-6">{children}</main>
      </div>
    </div>
  );
}
