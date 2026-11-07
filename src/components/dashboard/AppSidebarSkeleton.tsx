import {
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarMenu,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import { Skeleton } from "@/components/ui/skeleton";

const ROWS = ["w-24", "w-20", "w-16", "w-28", "w-14", "w-20", "w-16"];

function SkeletonRow({ width }: Readonly<{ width: string }>) {
  return (
    <SidebarMenuItem className="flex h-8 items-center gap-2 px-2">
      <Skeleton className="size-4 shrink-0" />
      {/* Fixed widths: `SidebarMenuSkeleton` picks a random one, which would differ between server and client. */}
      <Skeleton className={`h-4 ${width} group-data-[collapsible=icon]:hidden`} />
    </SidebarMenuItem>
  );
}

/** Stands in for the sidebar's content while it reads the session and the collections. */
export function AppSidebarSkeleton() {
  return (
    <>
      <SidebarContent>
        <SidebarGroup>
          <SidebarMenu>
            {ROWS.map((width, index) => (
              <SkeletonRow key={index} width={width} />
            ))}
          </SidebarMenu>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter>
        <SidebarMenu>
          <SkeletonRow width="w-24" />
        </SidebarMenu>
      </SidebarFooter>
    </>
  );
}
