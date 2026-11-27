import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { connection } from "next/server";
import { Suspense } from "react";

import { auth } from "@/auth";
import { ApiTokensManager } from "@/components/settings/ApiTokensManager";
import { ChangePasswordDialog } from "@/components/profile/ChangePasswordDialog";
import { DeleteAccountDialog } from "@/components/profile/DeleteAccountDialog";
import { EditorPreferencesForm } from "@/components/settings/EditorPreferencesForm";
import { ExportDataCard } from "@/components/settings/ExportDataCard";
import { ImportDataCard } from "@/components/settings/ImportDataCard";
import { ItemTypesManager } from "@/components/settings/ItemTypesManager";
import { LanguageForm } from "@/components/settings/LanguageForm";
import { UpgradeButtons } from "@/components/settings/UpgradeButtons";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { formatProUntil, parseCurrency } from "@/lib/billing-plans";
import { listApiTokens, MAX_API_TOKENS } from "@/lib/db/api-tokens";
import { getPlanStatus } from "@/lib/db/billing";
import { DEMO_USER_EMAIL } from "@/lib/db/collections";
import { getCustomTypes, MAX_CUSTOM_TYPES } from "@/lib/db/item-types";
import { getProfile } from "@/lib/db/profile";
import { FREE_LIMITS, canUseApiWrite, canUseCustomTypes } from "@/lib/usage-limits";
import { pageMetadata } from "@/i18n/labels-server";

/** The REST API reference (C2), `docs/api.md` in the repository. */
const API_DOCS_URL = "https://github.com/c0ding-L/codstash/blob/main/docs/api.md";

/** Server actions take the page's limit: Suggest Tags and Description wait on a slow free model. */
export const maxDuration = 60;

export function generateMetadata(): Promise<Metadata> {
  return pageMetadata("settings.title");
}

interface SettingsPageProps {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

export default async function SettingsPage({ searchParams }: SettingsPageProps) {
  // Rendered per request, like every other page.
  await connection();

  // The proxy already guards `/settings`; this also covers a JWT whose user row
  // was deleted, which the proxy cannot see.
  const session = await auth();
  const profile = session?.user?.id ? await getProfile(session.user.id) : null;
  if (!profile) redirect("/sign-in?callbackUrl=/settings");

  // `?currency=` comes from the pricing page's "Get Pro" link.
  const [plan, customTypes, apiTokens, { currency }, t, locale] = await Promise.all([
    getPlanStatus(profile.id),
    getCustomTypes(profile.id),
    listApiTokens(profile.id),
    searchParams,
    getTranslations("settings"),
    getLocale(),
  ]);

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-8">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold">{t("title")}</h1>
        <p className="text-sm text-muted-foreground">{t("subtitle")}</p>
      </div>

      <section id="plan" className="flex scroll-mt-20 flex-col gap-4">
        <h2 className="text-lg font-semibold">{t("plan.heading")}</h2>
        <Card>
          <CardHeader>
            <CardTitle>
              {plan.isPro && plan.proUntil
                ? t("plan.proUntil", { date: formatProUntil(plan.proUntil, locale) })
                : t("plan.free")}
            </CardTitle>
            <CardDescription>
              {plan.isPro
                ? t("plan.proDescription")
                : t("plan.freeDescription", {
                    items: plan.items,
                    maxItems: FREE_LIMITS.items,
                    collections: plan.collections,
                    maxCollections: FREE_LIMITS.collections,
                  })}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <UpgradeButtons initialCurrency={parseCurrency(currency)} isPro={plan.isPro} />
          </CardContent>
        </Card>
      </section>

      <section className="flex flex-col gap-4">
        <h2 className="text-lg font-semibold">{t("editor.heading")}</h2>
        <Card>
          <CardHeader>
            <CardTitle>{t("editor.title")}</CardTitle>
            <CardDescription>{t("editor.description")}</CardDescription>
          </CardHeader>
          <CardContent>
            <Suspense fallback={<Skeleton className="h-64 w-full" />}>
              <EditorPreferencesForm />
            </Suspense>
          </CardContent>
        </Card>
      </section>

      <section className="flex flex-col gap-4">
        <h2 className="text-lg font-semibold">{t("language.heading")}</h2>
        <Card>
          <CardHeader>
            <CardDescription>{t("language.description")}</CardDescription>
          </CardHeader>
          <CardContent>
            <LanguageForm />
          </CardContent>
        </Card>
      </section>

      <section id="types" className="flex scroll-mt-20 flex-col gap-4">
        <h2 className="text-lg font-semibold">{t("types.heading")}</h2>
        <Card>
          <CardHeader>
            <CardTitle>{t("types.title")}</CardTitle>
            <CardDescription>{t("types.description", { max: MAX_CUSTOM_TYPES })}</CardDescription>
          </CardHeader>
          <CardContent>
            <ItemTypesManager
              types={customTypes.map(({ id, slug, name, icon, color, template, itemCount }) => ({
                id,
                slug,
                name,
                icon,
                color,
                template,
                itemCount,
              }))}
              canEdit={canUseCustomTypes(plan)}
              max={MAX_CUSTOM_TYPES}
            />
          </CardContent>
        </Card>
      </section>

      <section id="data" className="flex scroll-mt-20 flex-col gap-4">
        <h2 className="text-lg font-semibold">{t("data.heading")}</h2>
        <ExportDataCard isPro={plan.isPro} />
        <ImportDataCard plan={plan} />
      </section>

      <section id="api" className="flex scroll-mt-20 flex-col gap-4">
        <h2 className="text-lg font-semibold">{t("api.heading")}</h2>
        <Card>
          <CardHeader>
            <CardTitle>{t("api.title")}</CardTitle>
            <CardDescription className="flex flex-col gap-2">
              <span>{t("api.description", { max: MAX_API_TOKENS })}</span>
              <a
                href={API_DOCS_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="w-fit text-primary underline underline-offset-4"
              >
                {t("api.docs")}
              </a>
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ApiTokensManager tokens={apiTokens} canWrite={canUseApiWrite(plan)} max={MAX_API_TOKENS} />
          </CardContent>
        </Card>
      </section>

      <section className="flex flex-col gap-4">
        <h2 className="text-lg font-semibold">{t("account.heading")}</h2>
        <Card>
          <CardHeader>
            <CardTitle>{t("account.password")}</CardTitle>
            <CardDescription>
              {profile.hasPassword
                ? t("account.passwordDescription")
                : t("account.githubOnly")}
            </CardDescription>
          </CardHeader>
          {profile.hasPassword ? (
            <CardContent>
              <ChangePasswordDialog />
            </CardContent>
          ) : null}
        </Card>

        <Card className="ring-destructive/40">
          <CardHeader>
            <CardTitle>{t("account.delete")}</CardTitle>
            <CardDescription>{t("account.deleteDescription")}</CardDescription>
          </CardHeader>
          <CardContent>
            <DeleteAccountDialog
              email={profile.email}
              isDemo={profile.email === DEMO_USER_EMAIL}
              hasPassword={profile.hasPassword}
            />
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
