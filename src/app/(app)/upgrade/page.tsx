import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { connection } from "next/server";

import { auth } from "@/auth";
import { UpgradePlans } from "@/components/billing/UpgradePlans";
import { parseCurrency } from "@/lib/billing-plans";
import { getPlanStatus } from "@/lib/db/billing";
import { FREE_LIMITS } from "@/lib/usage-limits";
import { pageMetadata } from "@/i18n/labels-server";

/** Server actions take the page's limit: Suggest Tags and Description wait on a slow free model. */
export const maxDuration = 60;

export function generateMetadata(): Promise<Metadata> {
  return pageMetadata("upgrade.title");
}

interface UpgradePageProps {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

export default async function UpgradePage({ searchParams }: UpgradePageProps) {
  // Rendered per request, like every other page.
  await connection();

  const session = await auth();
  if (!session?.user?.id) redirect("/sign-in?callbackUrl=/upgrade");

  const [plan, { currency }] = await Promise.all([getPlanStatus(session.user.id), searchParams]);
  // Pro users extend from Settings, where their end date is shown.
  if (plan.isPro) redirect("/settings#plan");
  const t = await getTranslations("upgrade");

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-10">
      <div className="flex flex-col gap-1 text-center">
        <h1 className="text-2xl font-semibold">{t("title")}</h1>
        <p className="text-sm text-muted-foreground">
          {t("subtitle", {
            items: plan.items,
            maxItems: FREE_LIMITS.items,
            collections: plan.collections,
            maxCollections: FREE_LIMITS.collections,
          })}
        </p>
      </div>
      <UpgradePlans initialCurrency={parseCurrency(currency)} />
    </div>
  );
}
