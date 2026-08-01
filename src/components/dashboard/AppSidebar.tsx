import Link from "next/link";
import { Clock, Code2, Settings, Star } from "lucide-react";

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
  colorClasses,
  itemTypeHref,
  typeById,
  typeIcons,
} from "@/lib/item-type-ui";
import { collections, currentUser, itemTypes, recentCollections } from "@/lib/mock-data";

const favoriteCollections = collections.filter(
  (collection) => collection.isFavorite,
);

export function AppSidebar() {
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
              {itemTypes.map((type) => {
                const Icon = typeIcons[type.slug];
                return (
                  <SidebarMenuItem key={type.id}>
                    <SidebarMenuButton
                      tooltip={type.pluralName}
                      render={<Link href={itemTypeHref(type)} />}
                    >
                      <Icon className={colorClasses[type.color]} aria-hidden />
                      <span>{type.pluralName}</span>
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
                const type = typeById(collection.primaryTypeId);
                const Icon = type ? typeIcons[type.slug] : Star;
                return (
                  <SidebarMenuItem key={collection.id}>
                    <SidebarMenuButton tooltip={collection.name}>
                      <Icon
                        className={type ? colorClasses[type.color] : undefined}
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
                const type = typeById(collection.primaryTypeId);
                const Icon = type ? typeIcons[type.slug] : Clock;
                return (
                  <SidebarMenuItem key={collection.id}>
                    <SidebarMenuButton tooltip={collection.name}>
                      <Icon
                        className={type ? colorClasses[type.color] : undefined}
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
            <SidebarMenuButton size="lg" tooltip={currentUser.name}>
              <Avatar className="size-7 rounded-lg">
                {currentUser.image ? (
                  <AvatarImage src={currentUser.image} alt="" />
                ) : null}
                <AvatarFallback className="rounded-lg text-xs">
                  {currentUser.initials}
                </AvatarFallback>
              </Avatar>
              <span className="grid flex-1 text-left leading-tight">
                <span className="truncate text-sm font-medium">
                  {currentUser.name}
                </span>
                <span className="truncate text-xs text-sidebar-foreground/70">
                  {currentUser.email}
                </span>
              </span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
