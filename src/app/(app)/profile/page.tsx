import { FolderOpen, Layers } from "lucide-react";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { connection } from "next/server";

import { auth } from "@/auth";
import { UserAvatar } from "@/components/auth/UserAvatar";
import { TypeIconTile } from "@/components/items/TypeIconTile";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getProfile, getProfileStats } from "@/lib/db/profile";
import { getTypeView } from "@/i18n/labels-server";
import { pageMetadata } from "@/i18n/labels-server";

/** Server actions take the page's limit: Suggest Tags and Description wait on a slow free model. */
export const maxDuration = 60;

export function generateMetadata(): Promise<Metadata> {
  return pageMetadata("profile.title");
}

export default async function ProfilePage() {
  // Rendered per request, like every other page.
  await connection();

  // The proxy already guards `/profile`; this also covers a JWT whose user row
  // was deleted, which the proxy cannot see.
  const session = await auth();
  const profile = session?.user?.id ? await getProfile(session.user.id) : null;
  if (!profile) redirect("/sign-in?callbackUrl=/profile");

  const [stats, t, typeView, locale] = await Promise.all([
    getProfileStats(profile.id),
    getTranslations("profile"),
    getTypeView(),
    getLocale(),
  ]);
  const memberSince = new Intl.DateTimeFormat(locale, { dateStyle: "long", timeZone: "UTC" });
  const totals = [
    { label: t("items"), value: stats.totalItems, icon: Layers },
    { label: t("collections"), value: stats.collectionCount, icon: FolderOpen },
  ];

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold">{t("title")}</h1>
        <p className="text-sm text-muted-foreground">{t("subtitle")}</p>
      </div>

      <Card>
        <CardContent className="flex items-center gap-4">
          <UserAvatar
            name={profile.name}
            email={profile.email}
            image={profile.image}
            className="size-16 rounded-xl text-lg"
          />
          <div className="grid min-w-0 gap-0.5">
            <span className="truncate text-lg font-semibold">{profile.name ?? profile.email}</span>
            <span className="truncate text-sm text-muted-foreground">{profile.email}</span>
            <span className="text-xs text-muted-foreground">
              {t("memberSince", { date: memberSince.format(profile.createdAt) })}
            </span>
          </div>
        </CardContent>
      </Card>

      <section className="flex flex-col gap-4">
        <h2 className="text-lg font-semibold">{t("usage")}</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          {totals.map(({ label, value, icon: Icon }) => (
            <Card key={label}>
              <CardContent className="flex flex-col gap-1">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                    {label}
                  </span>
                  <Icon className="size-4 text-muted-foreground" aria-hidden />
                </div>
                <span className="text-3xl font-semibold tabular-nums">{value}</span>
              </CardContent>
            </Card>
          ))}
        </div>
        <Card>
          <CardHeader>
            <CardTitle>{t("byType")}</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="grid gap-2 sm:grid-cols-2">
              {stats.byType.map((type) => {
                const view = typeView(type, "other");
                return (
                  <li key={`${type.isSystem}-${type.slug}`} className="flex items-center gap-3 rounded-lg px-2 py-1.5">
                    <TypeIconTile icon={view.Icon} color={view.color} className="size-8 rounded-md" iconClassName="size-4" />
                    <span className="flex-1">{view.label}</span>
                    <span className="font-medium tabular-nums">{type.count}</span>
                  </li>
                );
              })}
            </ul>
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
