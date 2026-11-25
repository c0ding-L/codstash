"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { useState } from "react";

import { BillingPeriodSwitch } from "@/components/billing/BillingPeriodSwitch";
import { CurrencySwitch } from "@/components/billing/CurrencySwitch";
import { FreePlanCard, ProPlanCard } from "@/components/billing/PlanCards";
import { buttonVariants } from "@/components/ui/button";
import { DEFAULT_CURRENCY, PAYMENT_METHODS, type Currency, type Plan } from "@/lib/billing-plans";
import { cn } from "@/lib/utils";

/**
 * Free and Pro side by side, with a monthly / yearly switch for the Pro price
 * and a currency switch for both. Display only: the currency is passed to
 * Settings, not stored.
 */
export function PricingPlans() {
  // Only the payment line is translated here; the rest of the homepage is Phase 4.
  const t = useTranslations("billing");
  const [plan, setPlan] = useState<Plan>("MONTHLY");
  const [currency, setCurrency] = useState<Currency>(DEFAULT_CURRENCY);

  return (
    <div>
      <div className="flex flex-wrap items-center justify-center gap-3">
        <BillingPeriodSwitch value={plan} onChange={setPlan} />
        <CurrencySwitch value={currency} onChange={setCurrency} />
      </div>
      <p className="mt-3 text-center text-xs text-muted-foreground">
        {t(`paymentMethods.${PAYMENT_METHODS[currency]}`)}
        {currency === "XOF" ? t("westAfrica") : null}
      </p>

      <div className="mx-auto mt-12 grid max-w-4xl gap-5 md:grid-cols-2">
        <FreePlanCard
          currency={currency}
          action={
            <Link href="/register" className={cn(buttonVariants({ variant: "outline", size: "lg" }), "mt-8 h-9")}>
              Get Started
            </Link>
          }
        />
        <ProPlanCard
          plan={plan}
          currency={currency}
          action={
            // Signed-out visitors go through sign-in, which returns them to Settings (the hash is lost, but Plan is the first section).
            <Link href={`/settings?currency=${currency}#plan`} className={cn(buttonVariants({ size: "lg" }), "mt-8 h-9")}>
              Get Pro
            </Link>
          }
        />
      </div>
    </div>
  );
}
