"use client";

import { useLocale, useTranslations } from "next-intl";
import { useState, useTransition } from "react";

import { startCheckout } from "@/actions/billing";
import { CurrencySwitch } from "@/components/billing/CurrencySwitch";
import { Button } from "@/components/ui/button";
import { BILLING_PLANS, PAYMENT_METHODS, PLANS, formatPrice, type Currency, type Plan } from "@/lib/billing-plans";

interface UpgradeButtonsProps {
  /** From `?currency=`, or the default. */
  initialCurrency: Currency;
  /** Pro users extend instead of upgrading; the paid time stacks on what is left. */
  isPro: boolean;
}

/** Currency switch plus one checkout button per plan. */
export function UpgradeButtons({ initialCurrency, isPro }: UpgradeButtonsProps) {
  const t = useTranslations("billing");
  const locale = useLocale();
  const [currency, setCurrency] = useState<Currency>(initialCurrency);
  const [pendingPlan, setPendingPlan] = useState<Plan | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function checkout(plan: Plan) {
    setError(null);
    setPendingPlan(plan);
    startTransition(async () => {
      const result = await startCheckout({ plan, currency });
      if (result.success) {
        // External URL: a full navigation, and the button stays pending until it happens.
        window.location.assign(result.redirectUrl);
        return;
      }
      setError(result.error);
      setPendingPlan(null);
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <CurrencySwitch value={currency} onChange={setCurrency} />
        <span className="text-sm text-muted-foreground">{t(`paymentMethods.${PAYMENT_METHODS[currency]}`)}</span>
      </div>

      <div className="flex flex-col gap-2 sm:flex-row">
        {PLANS.map((plan) => (
          <Button
            key={plan}
            variant={plan === "YEARLY" ? "default" : "outline"}
            disabled={isPending}
            onClick={() => checkout(plan)}
          >
            {pendingPlan === plan
              ? t("openingCheckout")
              : t(isPro ? "extendBy" : "upgradeFor", {
                  plan,
                  price: formatPrice(BILLING_PLANS[plan].price[currency], currency, locale),
                })}
          </Button>
        ))}
      </div>

      {error ? (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      ) : null}
    </div>
  );
}
