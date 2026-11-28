import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import Link from "next/link";
import { connection } from "next/server";

import { auth } from "@/auth";
import { AdminUserActions } from "@/components/admin/AdminUserActions";
import { Pagination } from "@/components/Pagination";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { pageMetadata } from "@/i18n/labels-server";
import { formatPrice, formatProUntil, isProActive } from "@/lib/billing-plans";
import {
  ADMIN_USERS_PER_PAGE,
  MAX_ADMIN_QUERY_LENGTH,
  getAdminStats,
  isAdminUser,
  listAdminUsers,
  type AdminUserRow,
} from "@/lib/db/admin";
import { DEMO_USER_EMAIL } from "@/lib/db/collections";
import { pageCount, parsePageParam } from "@/lib/pagination";

export function generateMetadata(): Promise<Metadata> {
  return pageMetadata("admin.title");
}

interface AdminPageProps {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

/**
 * Stats and the user list, for admins only. Anyone else gets the 404 page, so the route does
 * not show it exists. The role is read from the database, not the session. Account data and
 * counts only: no user's items or content.
 */
export default async function AdminPage({ searchParams }: AdminPageProps) {
  await connection();

  const session = await auth();
  if (!session?.user?.id || !(await isAdminUser(session.user.id))) notFound();
  const viewerId = session.user.id;

  const params = await searchParams;
  const page = parsePageParam(params.page);
  if (page === null) notFound();
  const query = typeof params.q === "string" ? params.q.trim().slice(0, MAX_ADMIN_QUERY_LENGTH) : "";

  const [stats, users, t, tc, locale] = await Promise.all([
    getAdminStats(),
    listAdminUsers({ query, page }),
    getTranslations("admin"),
    getTranslations("common"),
    getLocale(),
  ]);
  const pages = pageCount(users.total, ADMIN_USERS_PER_PAGE);
  if (page > pages) notFound();

  const statCards = [
    { label: t("stats.users"), value: stats.users },
    { label: t("stats.verifiedUsers"), value: stats.verifiedUsers },
    { label: t("stats.activePro"), value: stats.activePro },
    { label: t("stats.signups"), value: stats.signupsLast30Days },
    { label: t("stats.items"), value: stats.items },
    { label: t("stats.collections"), value: stats.collections },
  ];
  const number = new Intl.NumberFormat(locale === "fr" ? "fr-FR" : "en-US");
  const basePath = query ? `/admin?q=${encodeURIComponent(query)}` : "/admin";

  const planLabel = (user: AdminUserRow) => {
    if (user.role === "ADMIN") return t("plan.admin");
    if (user.proUntil && user.isPro) return t("plan.proUntil", { date: formatProUntil(user.proUntil, locale) });
    return t("plan.free");
  };

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-8">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold">{t("title")}</h1>
        <p className="text-sm text-muted-foreground">{t("subtitle")}</p>
      </div>

      <section className="flex flex-col gap-4">
        <h2 className="text-lg font-semibold">{t("stats.heading")}</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {statCards.map((card) => (
            <Card key={card.label} size="sm">
              <CardHeader>
                <CardDescription>{card.label}</CardDescription>
                <CardTitle className="text-2xl tabular-nums">{number.format(card.value)}</CardTitle>
              </CardHeader>
            </Card>
          ))}
        </div>
        <Card size="sm">
          <CardHeader>
            <CardDescription>{t("stats.revenue")}</CardDescription>
          </CardHeader>
          <CardContent>
            {stats.revenue.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t("stats.revenueNone")}</p>
            ) : (
              <ul className="flex flex-wrap gap-x-8 gap-y-2">
                {stats.revenue.map((row) => (
                  <li key={row.currency} className="flex flex-col">
                    <span className="text-xl font-semibold tabular-nums">
                      {formatPrice(row.amount, row.currency, locale)}
                    </span>
                    <span className="text-xs text-muted-foreground">{t("stats.payments", { count: row.count })}</span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </section>

      <section className="flex flex-col gap-4">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-lg font-semibold">{t("users.heading")}</h2>
          <span className="text-sm text-muted-foreground">{t("users.count", { count: users.total })}</span>
        </div>

        <form action="/admin" method="get" role="search" className="flex gap-2">
          <Input
            type="search"
            name="q"
            defaultValue={query}
            maxLength={MAX_ADMIN_QUERY_LENGTH}
            placeholder={t("users.searchPlaceholder")}
            aria-label={t("users.searchLabel")}
            className="min-w-0 flex-1"
          />
          <Button type="submit" variant="outline">
            {t("users.search")}
          </Button>
          {query ? (
            <Link href="/admin" className={buttonVariants({ variant: "ghost" })}>
              {t("users.clear")}
            </Link>
          ) : null}
        </form>

        {users.rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("users.empty")}</p>
        ) : (
          <Card size="sm" className="py-0">
            <ul className="divide-y">
              {users.rows.map((user) => (
                <li key={user.id} className="flex items-start gap-3 px-4 py-3">
                  <div className="flex min-w-0 flex-1 flex-col gap-1">
                    <div className="flex min-w-0 flex-wrap items-center gap-2">
                      <span className="truncate font-medium">{user.email}</span>
                      {user.id === viewerId ? <Badge variant="outline">{t("users.you")}</Badge> : null}
                      <Badge variant={user.isPro ? "default" : "secondary"}>{planLabel(user)}</Badge>
                    </div>
                    <p className="flex flex-wrap gap-x-4 gap-y-0.5 text-xs text-muted-foreground">
                      {user.name ? <span className="truncate">{user.name}</span> : null}
                      <span>{t("users.joined", { date: formatProUntil(user.createdAt, locale) })}</span>
                      <span>{user.verified ? t("users.verified") : t("users.notVerified")}</span>
                      <span className="tabular-nums">{tc("itemCount", { count: user.itemCount })}</span>
                    </p>
                  </div>
                  <AdminUserActions
                    user={{ id: user.id, email: user.email }}
                    hasPaidPro={isProActive(user.proUntil)}
                    deletable={user.role !== "ADMIN" && user.id !== viewerId && user.email !== DEMO_USER_EMAIL}
                  />
                </li>
              ))}
            </ul>
          </Card>
        )}

        <Pagination basePath={basePath} page={page} pageCount={pages} rowIds={users.rows.map((user) => user.id)} />
      </section>
    </div>
  );
}
