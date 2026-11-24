import { Check, X } from "lucide-react";

import { BILLING_PLANS, formatPrice, formatYearlyPerMonth, type Currency, type Plan } from "@/lib/billing-plans";
import { cn } from "@/lib/utils";

const freeFeatures = [
  { label: "50 items", included: true },
  { label: "3 collections", included: true },
  { label: "Basic search", included: true },
  { label: "No AI features", included: false },
];

const proFeatures = [
  "Unlimited items & collections",
  "File & image uploads",
  "Custom item types",
  "AI features",
  "Export (JSON / ZIP)",
];

/** The Free plan, for the homepage pricing and `/upgrade`. `action` is the button at the bottom. */
export function FreePlanCard({ currency, action }: { currency: Currency; action: React.ReactNode }) {
  return (
    <div className="flex flex-col rounded-2xl border border-border bg-card/60 p-8">
      <h3 className="font-medium">Free</h3>
      <p className="mt-4 flex items-baseline gap-1">
        <span className="text-4xl font-semibold tracking-tight whitespace-nowrap">{formatPrice(0, currency)}</span>
        <span className="text-muted-foreground">/forever</span>
      </p>
      <ul className="mt-8 flex-1 space-y-3 text-sm">
        {freeFeatures.map((feature) => (
          <li key={feature.label} className={cn("flex items-center gap-3", !feature.included && "text-muted-foreground")}>
            {feature.included ? <Check className="size-4 text-emerald-400" aria-hidden /> : <X className="size-4" aria-hidden />}
            {feature.label}
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
  return (
    <div className="relative flex flex-col rounded-2xl border border-neutral-500 bg-card p-8 shadow-2xl shadow-black/50">
      <span className="absolute -top-3 left-8 rounded-full bg-primary px-3 py-0.5 text-xs font-medium text-primary-foreground">
        Most Popular
      </span>
      <h3 className="font-medium">Pro</h3>
      {/* The monthly figure goes on its own line: "36 000 FCFA" leaves no room beside it. */}
      <p className="mt-4 flex flex-wrap items-baseline gap-x-1 gap-y-1">
        <span className="text-4xl font-semibold tracking-tight whitespace-nowrap">
          {formatPrice(BILLING_PLANS[plan].price[currency], currency)}
        </span>
        <span className="text-muted-foreground">/{plan === "MONTHLY" ? "month" : "year"}</span>
        {plan === "YEARLY" ? (
          <span className="w-full text-sm text-muted-foreground">{formatYearlyPerMonth(currency)}/month</span>
        ) : null}
      </p>
      <ul className="mt-8 flex-1 space-y-3 text-sm">
        {proFeatures.map((feature) => (
          <li key={feature} className="flex items-center gap-3">
            <Check className="size-4 text-emerald-400" aria-hidden />
            {feature}
          </li>
        ))}
      </ul>
      {action}
    </div>
  );
}
