import Link from "next/link";
import { Clock, Folders, LayoutDashboard, Layers, type LucideIcon, ShieldCheck, Star } from "lucide-react";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { connection } from "next/server";
import { Suspense } from "react";

import { auth } from "@/auth";
import { UserMenu } from "@/components/auth/UserMenu";
import { AppSidebarSkeleton } from "@/components/dashboard/AppSidebarSkeleton";
import { SidebarNavButton } from "@/components/dashboard/SidebarNavButton";
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
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import {
  getFavoriteCollections,
  getItemTypes,
  getSidebarRecentCollections,
  type ItemTypeRow,
  type SidebarCollection,
} from "@/lib/db/collections";
import { viewType } from "@/i18n/labels";
import { getCustomTypes, type CustomType } from "@/lib/db/item-types";
import {
  colorClasses,
  customTypeIcon,
  DEFAULT_CUSTOM_COLOR,
  itemTypeHref,
  proTypeSlugs,
  sidebarTypes,
  toColorToken,
  typeIcons,
  type TypeView,
} from "@/lib/item-type-ui";
import { cn } from "@/lib/utils";
import type { ColorToken } from "@/types/item-type";

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
  const [itemTypes, customTypes, favoriteCollections, recentCollections, t, tTypes] = await Promise.all([
    getItemTypes(userId),
    getCustomTypes(userId),
    getFavoriteCollections(userId),
    getSidebarRecentCollections(userId),
    getTranslations(),
    getTranslations("itemTypes"),
  ]);
  // A collection is marked by its most used type (they come sorted by count).
  const primaryView = (collection: SidebarCollection) =>
    collection.types[0] ? viewType(tTypes, collection.types[0], "one") : null;

  return (
    <>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarNavButton href="/dashboard" exact tooltip={t("dashboard.title")}>
                  <LayoutDashboard aria-hidden />
                  <span>{t("dashboard.title")}</span>
                </SidebarNavButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
        <SidebarTypesGroup
          label={t("nav.types")}
          itemTypes={itemTypes
            .filter((type) => type.isSystem)
            .map((type) => ({ ...type, label: viewType(tTypes, type, "other").label }))}
        />
        {customTypes.length > 0 ? <SidebarCustomTypesGroup label={t("nav.customTypes")} types={customTypes} /> : null}
        <SidebarCollectionsGroup
          label={t("nav.favoriteCollections")}
          variant="favorite"
          collections={favoriteCollections.map((collection) => ({ ...collection, primary: primaryView(collection) }))}
        />
        <SidebarCollectionsGroup
          label={t("nav.recent")}
          variant="recent"
          collections={recentCollections.map((collection) => ({ ...collection, primary: primaryView(collection) }))}
        />

        {/* In a group like the entries above, so it gets their padding and lines up. */}
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarNavButton href="/collections" exact tooltip={t("nav.viewAllCollections")}>
                  <Folders aria-hidden />
                  <span>{t("nav.viewAllCollections")}</span>
                </SidebarNavButton>
              </SidebarMenuItem>
              {/* The session's role, for the link only: /admin re-reads it from the database. */}
              {user.role === "ADMIN" ? (
                <SidebarMenuItem>
                  <SidebarNavButton href="/admin" exact tooltip={t("nav.admin")}>
                    <ShieldCheck aria-hidden />
                    <span>{t("nav.admin")}</span>
                  </SidebarNavButton>
                </SidebarMenuItem>
              ) : null}
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
                <SidebarNavButton href={itemTypeHref(slug)} tooltip={label}>
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
                </SidebarNavButton>
              </SidebarMenuItem>
            );
          })}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  );
}

/** The user's custom types, by name, each linking to its list with its item count. Hidden when there are none. */
function SidebarCustomTypesGroup({ label, types }: { label: string; types: CustomType[] }) {
  return (
    <SidebarGroup>
      <SidebarGroupLabel>{label}</SidebarGroupLabel>
      <SidebarGroupContent>
        <SidebarMenu>
          {types.map((type) => {
            const Icon = customTypeIcon(type.icon);
            const color = toColorToken(type.color) ?? DEFAULT_CUSTOM_COLOR;
            return (
              <SidebarMenuItem key={type.id}>
                {/* The author's own name, never translated. */}
                <SidebarNavButton href={`/items/${type.slug}`} tooltip={type.name}>
                  <Icon className={colorClasses[color]} aria-hidden />
                  <span>{type.name}</span>
                  <span className="ml-auto text-xs text-muted-foreground tabular-nums group-data-[collapsible=icon]:hidden">
                    {type.itemCount}
                  </span>
                </SidebarNavButton>
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
  collections: (SidebarCollection & { primary: TypeView | null })[];
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
            const icon = collection.primary?.Icon ?? null;
            const color = collection.primary?.color ?? null;

            return (
              <SidebarMenuItem key={collection.id}>
                <SidebarNavButton href={`/collections/${collection.id}`} tooltip={collection.name}>
                  {variant === "favorite" ? (
                    <FavoriteIcon icon={icon} color={color} />
                  ) : (
                    <TypeIconTile
                      icon={icon}
                      color={color}
                      className="size-5 shrink-0 rounded-full"
                      iconClassName="size-3.5"
                    />
                  )}
                  <span>{collection.name}</span>
                </SidebarNavButton>
              </SidebarMenuItem>
            );
          })}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  );
}

function FavoriteIcon({ icon, color }: { icon: LucideIcon | null; color: ColorToken | null }) {
  const Icon = icon ?? Star;
  return <Icon className={cn(color && colorClasses[color])} aria-hidden />;
}
