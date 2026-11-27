import { Check, X } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";

import { BILLING_PLANS, formatPrice, formatYearlyPerMonth, type Currency, type Plan } from "@/lib/billing-plans";
import { cn } from "@/lib/utils";

/** Keys of the `billing.freeFeatures` / `billing.proFeatures` messages, in display order. */
const freeFeatures = [
  { key: "items", included: true },
  { key: "collections", included: true },
  { key: "search", included: true },
  { key: "variables", included: true },
  { key: "contextExport", included: true },
  { key: "apiRead", included: true },
  { key: "noAi", included: false },
] as const;

const proFeatures = ["unlimited", "uploads", "customTypes", "ai", "export", "apiWrite"] as const;

/** The Free plan, for the homepage pricing and `/upgrade`. `action` is the button at the bottom. */
export function FreePlanCard({ currency, action }: { currency: Currency; action: React.ReactNode }) {
  const t = useTranslations("billing");
  const locale = useLocale();
  return (
    <div className="flex flex-col rounded-2xl border border-border bg-card/60 p-8">
      <h3 className="font-medium">{t("free")}</h3>
      <p className="mt-4 flex items-baseline gap-1">
        <span className="text-4xl font-semibold tracking-tight whitespace-nowrap">{formatPrice(0, currency, locale)}</span>
        <span className="text-muted-foreground">{t("forever")}</span>
      </p>
      <ul className="mt-8 flex-1 space-y-3 text-sm">
        {freeFeatures.map((feature) => (
          <li key={feature.key} className={cn("flex items-center gap-3", !feature.included && "text-muted-foreground")}>
            {feature.included ? <Check className="size-4 text-emerald-400" aria-hidden /> : <X className="size-4" aria-hidden />}
            {t(`freeFeatures.${feature.key}`)}
          </li>
        ))}
      </ul>
      {action}
    </div>
  );
}

interface ProPlanCardProps {
  plan: Plan;
  currency: Currency;
  action: React.ReactNode;
}

/** The Pro plan at the chosen period and currency. */
export function ProPlanCard({ plan, currency, action }: ProPlanCardProps) {
  const t = useTranslations("billing");
  const locale = useLocale();
  return (
    <div className="relative flex flex-col rounded-2xl border border-neutral-500 bg-card p-8 shadow-2xl shadow-black/50">
      <span className="absolute -top-3 left-8 rounded-full bg-primary px-3 py-0.5 text-xs font-medium text-primary-foreground">
        {t("mostPopular")}
      </span>
      <h3 className="font-medium">{t("pro")}</h3>
      {/* The monthly figure goes on its own line: "36 000 FCFA" leaves no room beside it. */}
      <p className="mt-4 flex flex-wrap items-baseline gap-x-1 gap-y-1">
        <span className="text-4xl font-semibold tracking-tight whitespace-nowrap">
          {formatPrice(BILLING_PLANS[plan].price[currency], currency, locale)}
        </span>
        <span className="text-muted-foreground">{plan === "MONTHLY" ? t("perMonth") : t("perYear")}</span>
        {plan === "YEARLY" ? (
          <span className="w-full text-sm text-muted-foreground">
            {t("perMonthPrice", { price: formatYearlyPerMonth(currency, locale) })}
          </span>
        ) : null}
      </p>
      <ul className="mt-8 flex-1 space-y-3 text-sm">
        {proFeatures.map((feature) => (
          <li key={feature} className="flex items-center gap-3">
            <Check className="size-4 text-emerald-400" aria-hidden />
            {t(`proFeatures.${feature}`)}
          </li>
        ))}
      </ul>
      {action}
    </div>
  );
}
