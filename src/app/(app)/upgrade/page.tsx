import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { connection } from "next/server";

import { auth } from "@/auth";
import { UpgradePlans } from "@/components/billing/UpgradePlans";
import { parseCurrency } from "@/lib/billing-plans";
import { getPlanStatus } from "@/lib/db/billing";
import { FREE_LIMITS } from "@/lib/usage-limits";

export const metadata: Metadata = {
  title: "Upgrade · Cortex",
};

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

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-10">
      <div className="flex flex-col gap-1 text-center">
        <h1 className="text-2xl font-semibold">Upgrade to Pro</h1>
        <p className="text-sm text-muted-foreground">
          You are on Free: {plan.items}/{FREE_LIMITS.items} items, {plan.collections}/{FREE_LIMITS.collections}{" "}
          collections. Choose a plan to remove the limits.
        </p>
      </div>
      <UpgradePlans initialCurrency={parseCurrency(currency)} />
    </div>
  );
}
