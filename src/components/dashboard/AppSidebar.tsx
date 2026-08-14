import Link from "next/link";
import { Clock, Code2, FolderOpen, Settings, Star } from "lucide-react";
import { connection } from "next/server";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
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
  getDemoUser,
  getDemoUserId,
  getFavoriteCollections,
  getItemTypes,
  getSidebarRecentCollections,
} from "@/lib/db/collections";
import {
  colorClasses,
  initialsFromName,
  itemTypeHref,
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

  const userId = await getDemoUserId();
  const [itemTypes, favoriteCollections, recentCollections, user] = await Promise.all([
    getItemTypes(userId),
    getFavoriteCollections(userId),
    getSidebarRecentCollections(userId),
    getDemoUser(),
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
            <SidebarMenuButton size="lg" tooltip={user.name ?? user.email}>
              <Avatar className="size-7 rounded-lg">
                {user.image ? <AvatarImage src={user.image} alt="" /> : null}
                <AvatarFallback className="rounded-lg text-xs">
                  {initialsFromName(user.name)}
                </AvatarFallback>
              </Avatar>
              <span className="grid flex-1 text-left leading-tight">
                <span className="truncate text-sm font-medium">
                  {user.name ?? user.email}
                </span>
                <span className="truncate text-xs text-sidebar-foreground/70">
                  {user.email}
                </span>
              </span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
