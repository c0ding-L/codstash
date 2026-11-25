import Link from "next/link";
import { Clock, Folders, Layers, Star } from "lucide-react";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { connection } from "next/server";
import { Suspense } from "react";

import { auth } from "@/auth";
import { UserMenu } from "@/components/auth/UserMenu";
import { AppSidebarSkeleton } from "@/components/dashboard/AppSidebarSkeleton";
import { TypeIconTile } from "@/components/items/TypeIconTile";
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
  getFavoriteCollections,
  getItemTypes,
  getSidebarRecentCollections,
  type ItemTypeRow,
  type SidebarCollection,
} from "@/lib/db/collections";
import {
  colorClasses,
  itemTypeHref,
  primaryTypeOf,
  proTypeSlugs,
  sidebarTypes,
  toColorToken,
  toItemTypeSlug,
  typeIcons,
} from "@/lib/item-type-ui";
import { cn } from "@/lib/utils";
import type { ColorToken, ItemTypeSlug } from "@/types/item-type";

/**
 * `Sidebar` stays outside the boundary. It renders differently on phones once
 * `SidebarProvider` has measured the viewport, and a boundary around it would
 * hydrate after that change and no longer match the server's desktop HTML.
 */
export function AppSidebar() {
  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <Link
          href="/dashboard"
          className="flex items-center gap-2 overflow-hidden rounded-md p-1"
        >
          <span className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <Layers className="size-4" aria-hidden />
          </span>
          <span className="truncate font-semibold group-data-[collapsible=icon]:hidden">
            Cortex
          </span>
        </Link>
      </SidebarHeader>

      <Suspense fallback={<AppSidebarSkeleton />}>
        <AppSidebarBody />
      </Suspense>
    </Sidebar>
  );
}

async function AppSidebarBody() {
  // A Prisma query does not opt the layout out of prerendering on its own.
  await connection();

  // The proxy already keeps anonymous requests out of /dashboard; this only
  // narrows the type.
  const session = await auth();
  if (!session?.user?.id) redirect("/sign-in");
  const user = session.user;
  const userId = session.user.id;
  const [itemTypes, favoriteCollections, recentCollections, t] = await Promise.all([
    getItemTypes(userId),
    getFavoriteCollections(userId),
    getSidebarRecentCollections(userId),
    getTranslations(),
  ]);

  return (
    <>
      <SidebarContent>
        <SidebarTypesGroup
          label={t("nav.types")}
          itemTypes={itemTypes.map((type) => {
            const slug = toItemTypeSlug(type.slug);
            return { ...type, label: slug ? t(`itemTypes.${slug}.other`) : type.name };
          })}
        />
        <SidebarCollectionsGroup label={t("nav.favorites")} variant="favorite" collections={favoriteCollections} />
        <SidebarCollectionsGroup label={t("nav.recent")} variant="recent" collections={recentCollections} />

        {/* In a group like the entries above, so it gets their padding and lines up. */}
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton
                  tooltip={t("nav.viewAllCollections")}
                  render={<Link href="/collections" />}
                >
                  <Folders aria-hidden />
                  <span>{t("nav.viewAllCollections")}</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <UserMenu
              name={user.name ?? null}
              email={user.email ?? null}
              image={user.image ?? null}
            />
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </>
  );
}

/** The system types, each linking to its list, with a PRO badge where it applies. */
function SidebarTypesGroup({ label, itemTypes }: { label: string; itemTypes: (ItemTypeRow & { label: string })[] }) {
  const typeBySlug = new Map(itemTypes.map((type) => [type.slug, type]));

  return (
    <SidebarGroup>
      <SidebarGroupLabel>{label}</SidebarGroupLabel>
      <SidebarGroupContent>
        <SidebarMenu>
          {sidebarTypes.map(({ slug }) => {
            const type = typeBySlug.get(slug);
            if (!type) return null;
            const { label } = type;

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
                      className="ml-auto h-4 px-1.5 text-[11px] font-semibold tracking-wide text-muted-foreground group-data-[collapsible=icon]:hidden"
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
  );
}

interface SidebarCollectionsGroupProps {
  label: string;
  /** Favorite: the primary type's plain icon. Recent: the icon on its tinted disc. */
  variant: "favorite" | "recent";
  collections: SidebarCollection[];
}

/** The favorite or recent collections, each marked by its most used type. */
function SidebarCollectionsGroup({ label, variant, collections }: SidebarCollectionsGroupProps) {
  const LabelIcon = variant === "favorite" ? Star : Clock;

  return (
    <SidebarGroup>
      <SidebarGroupLabel>
        <LabelIcon className="mr-1.5" aria-hidden />
        {label}
      </SidebarGroupLabel>
      <SidebarGroupContent>
        <SidebarMenu>
          {collections.map((collection) => {
            const primary = primaryTypeOf(collection);
            const slug = primary?.slug ?? null;
            const color = primary?.color ?? null;

            return (
              <SidebarMenuItem key={collection.id}>
                <SidebarMenuButton
                  tooltip={collection.name}
                  render={<Link href={`/collections/${collection.id}`} />}
                >
                  {variant === "favorite" ? (
                    <FavoriteIcon slug={slug} color={color} />
                  ) : (
                    <TypeIconTile
                      slug={slug}
                      color={color}
                      className="size-5 shrink-0 rounded-full"
                      iconClassName="size-3.5"
                    />
                  )}
                  <span>{collection.name}</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            );
          })}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  );
}

function FavoriteIcon({ slug, color }: { slug: ItemTypeSlug | null; color: ColorToken | null }) {
  const Icon = slug ? typeIcons[slug] : Star;
  return <Icon className={cn(color && colorClasses[color])} aria-hidden />;
}
