"use client";

import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";

import { CurrencySwitch } from "@/components/billing/CurrencySwitch";
import { PaymentMethodsNote } from "@/components/billing/PaymentMethodsNote";
import { Button } from "@/components/ui/button";
import { useCheckout } from "@/hooks/use-checkout";
import { BILLING_PLANS, PLANS, formatPrice, type Currency, type Plan } from "@/lib/billing-plans";

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
  const { checkout: startCheckout, error, isPending } = useCheckout({ onFailure: () => setPendingPlan(null) });

  function checkout(plan: Plan) {
    setPendingPlan(plan);
    startCheckout(plan, currency);
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <CurrencySwitch value={currency} onChange={setCurrency} />
        <PaymentMethodsNote currency={currency} className="text-sm text-muted-foreground" />
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
