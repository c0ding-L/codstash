"use client";

import { useLocale, useTranslations } from "next-intl";
import { useState, useTransition } from "react";

import { startCheckout } from "@/actions/billing";
import { BillingPeriodSwitch } from "@/components/billing/BillingPeriodSwitch";
import { CurrencySwitch } from "@/components/billing/CurrencySwitch";
import { FreePlanCard, ProPlanCard } from "@/components/billing/PlanCards";
import { Button } from "@/components/ui/button";
import { BILLING_PLANS, PAYMENT_METHODS, formatPrice, type Currency, type Plan } from "@/lib/billing-plans";

/**
 * `/upgrade`: the pricing cards with the period and currency the user picks,
 * and one button that opens the Bictorys checkout for that choice.
 */
export function UpgradePlans({ initialCurrency }: { initialCurrency: Currency }) {
  const t = useTranslations("billing");
  const locale = useLocale();
  const [plan, setPlan] = useState<Plan>("YEARLY");
  const [currency, setCurrency] = useState<Currency>(initialCurrency);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function checkout() {
    setError(null);
    startTransition(async () => {
      const result = await startCheckout({ plan, currency });
      if (result.success) {
        // External URL: a full navigation, and the button stays pending until it happens.
        window.location.assign(result.redirectUrl);
        return;
      }
      setError(result.error);
    });
  }

  const price = formatPrice(BILLING_PLANS[plan].price[currency], currency, locale);

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
              <Button size="lg" className="h-9" disabled={isPending} onClick={checkout}>
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
