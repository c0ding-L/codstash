"use client";

import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";

import { BillingPeriodSwitch } from "@/components/billing/BillingPeriodSwitch";
import { CurrencySwitch } from "@/components/billing/CurrencySwitch";
import { PaymentMethodsNote } from "@/components/billing/PaymentMethodsNote";
import { FreePlanCard, ProPlanCard } from "@/components/billing/PlanCards";
import { Button } from "@/components/ui/button";
import { useCheckout } from "@/hooks/use-checkout";
import { BILLING_PLANS, formatPrice, type Currency, type Plan } from "@/lib/billing-plans";

/**
 * `/upgrade`: the pricing cards with the period and currency the user picks,
 * and one button that opens the Bictorys checkout for that choice.
 */
export function UpgradePlans({ initialCurrency }: { initialCurrency: Currency }) {
  const t = useTranslations("billing");
  const locale = useLocale();
  const [plan, setPlan] = useState<Plan>("YEARLY");
  const [currency, setCurrency] = useState<Currency>(initialCurrency);
  const { checkout, error, isPending } = useCheckout();

  const price = formatPrice(BILLING_PLANS[plan].price[currency], currency, locale);

  return (
    <div>
      <div className="flex flex-wrap items-center justify-center gap-3">
        <BillingPeriodSwitch value={plan} onChange={setPlan} />
        <CurrencySwitch value={currency} onChange={setCurrency} />
      </div>
      <PaymentMethodsNote currency={currency} className="mt-3 text-center text-xs text-muted-foreground" />

      <div className="mx-auto mt-10 grid max-w-4xl gap-5 md:grid-cols-2">
        <FreePlanCard
          currency={currency}
          action={
            <Button variant="outline" size="lg" className="mt-8 h-9" disabled>
              {t("currentPlan")}
            </Button>
          }
        />
        <ProPlanCard
          plan={plan}
          currency={currency}
          action={
            <div className="mt-8 flex flex-col gap-2">
              <Button size="lg" className="h-9" disabled={isPending} onClick={() => checkout(plan, currency)}>
                {isPending
                  ? t("openingCheckout")
                  : t(plan === "MONTHLY" ? "upgradeMonthly" : "upgradeYearly", { price })}
              </Button>
              {error ? (
                <p role="alert" className="text-sm text-destructive">
                  {error}
                </p>
              ) : null}
            </div>
          }
        />
      </div>
    </div>
  );
}
