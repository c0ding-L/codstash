import Link from "next/link";
import { Clock, Code2, FolderOpen, Settings, Star } from "lucide-react";
import { redirect } from "next/navigation";
import { connection } from "next/server";

import { auth } from "@/auth";
import { UserMenu } from "@/components/auth/UserMenu";
import { Badge } from "@/components/ui/badge";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import {
  getDemoUserId,
  getFavoriteCollections,
  getItemTypes,
  getSidebarRecentCollections,
} from "@/lib/db/collections";
import {
  colorClasses,
  itemTypeHref,
  proTypeSlugs,
  sidebarTypes,
  surfaceClasses,
  toColorToken,
  toItemTypeSlug,
  typeIcons,
} from "@/lib/item-type-ui";
import { cn } from "@/lib/utils";

export async function AppSidebar() {
  // A Prisma query does not opt the layout out of prerendering on its own.
  await connection();

  // The proxy already keeps anonymous requests out of /dashboard; this only
  // narrows the type.
  const session = await auth();
  if (!session?.user) redirect("/sign-in");
  const user = session.user;

  // Collections and items still come from the demo account until the queries
  // move to the session user.
  const userId = await getDemoUserId();
  const [itemTypes, favoriteCollections, recentCollections] = await Promise.all([
    getItemTypes(userId),
    getFavoriteCollections(userId),
    getSidebarRecentCollections(userId),
  ]);

  const typeBySlug = new Map(itemTypes.map((type) => [type.slug, type]));

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <Link
          href="/dashboard"
          className="flex items-center gap-2 overflow-hidden rounded-md p-1"
        >
          <span className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <Code2 className="size-4" aria-hidden />
          </span>
          <span className="truncate font-semibold group-data-[collapsible=icon]:hidden">
            CodStash
          </span>
        </Link>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Types</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {sidebarTypes.map(({ slug, label }) => {
                const type = typeBySlug.get(slug);
                if (!type) return null;

                const color = toColorToken(type.color);
                const Icon = typeIcons[slug];

                return (
                  <SidebarMenuItem key={type.id}>
                    <SidebarMenuButton
                      tooltip={label}
                      render={<Link href={itemTypeHref(slug)} />}
                    >
                      <Icon
                        className={cn(color && colorClasses[color])}
                        aria-hidden
                      />
                      <span>{label}</span>
                      {proTypeSlugs.has(slug) ? (
                        <Badge
                          variant="secondary"
                          className="ml-auto h-4 px-1.5 text-[10px] font-semibold tracking-wide text-muted-foreground group-data-[collapsible=icon]:hidden"
                        >
                          PRO
                        </Badge>
                      ) : null}
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupLabel>
            <Star className="mr-1.5" aria-hidden />
            Favorites
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {favoriteCollections.map((collection) => {
                const [primary] = collection.types;
                const primarySlug = primary ? toItemTypeSlug(primary.slug) : null;
                const primaryColor = primary ? toColorToken(primary.color) : null;
                const Icon = primarySlug ? typeIcons[primarySlug] : Star;

                return (
                  <SidebarMenuItem key={collection.id}>
                    <SidebarMenuButton tooltip={collection.name}>
                      <Icon
                        className={cn(primaryColor && colorClasses[primaryColor])}
                        aria-hidden
                      />
                      <span>{collection.name}</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupLabel>
            <Clock className="mr-1.5" aria-hidden />
            Recent
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {recentCollections.map((collection) => {
                const [primary] = collection.types;
                const primarySlug = primary ? toItemTypeSlug(primary.slug) : null;
                const primaryColor = primary ? toColorToken(primary.color) : null;
                const Icon = primarySlug ? typeIcons[primarySlug] : Clock;

                return (
                  <SidebarMenuItem key={collection.id}>
                    <SidebarMenuButton tooltip={collection.name}>
                      <span
                        className={cn(
                          "flex size-5 shrink-0 items-center justify-center rounded-full",
                          primaryColor ? surfaceClasses[primaryColor] : "bg-muted",
                        )}
                      >
                        <Icon
                          className={cn(
                            "size-3.5",
                            primaryColor && colorClasses[primaryColor],
                          )}
                          aria-hidden
                        />
                      </span>
                      <span>{collection.name}</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              tooltip="View all collections"
              render={<Link href="/collections" />}
            >
              <FolderOpen aria-hidden />
              <span>View all collections</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarContent>

      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton tooltip="Settings">
              <Settings aria-hidden />
              <span>Settings</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <UserMenu
              name={user.name ?? null}
              email={user.email ?? null}
              image={user.image ?? null}
            />
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
