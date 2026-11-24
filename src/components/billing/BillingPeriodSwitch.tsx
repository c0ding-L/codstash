"use client";

import { PLANS, type Plan } from "@/lib/billing-plans";
import { cn } from "@/lib/utils";

const PERIOD_LABEL: Record<Plan, string> = { MONTHLY: "Monthly", YEARLY: "Yearly" };

interface BillingPeriodSwitchProps {
  value: Plan;
  onChange: (plan: Plan) => void;
}

/** Monthly / yearly, with the yearly saving. Styled like `CurrencySwitch`. */
export function BillingPeriodSwitch({ value, onChange }: BillingPeriodSwitchProps) {
  return (
    <div role="group" aria-label="Billing period" className="inline-flex rounded-lg border border-border bg-card p-1 text-sm">
      {PLANS.map((plan) => (
        <button
          key={plan}
          type="button"
          aria-pressed={value === plan}
          onClick={() => onChange(plan)}
          className={cn(
            "flex items-center gap-1.5 rounded-md px-4 py-1.5 outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
            value === plan ? "bg-secondary text-foreground" : "text-muted-foreground hover:text-foreground",
          )}
        >
          {PERIOD_LABEL[plan]}
          {plan === "YEARLY" ? <span className="text-xs text-emerald-400">Save 25%</span> : null}
        </button>
      ))}
    </div>
  );
}
