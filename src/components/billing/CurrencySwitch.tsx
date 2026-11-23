"use client";

import { CURRENCIES, type Currency } from "@/lib/billing-plans";
import { cn } from "@/lib/utils";

interface CurrencySwitchProps {
  value: Currency;
  onChange: (currency: Currency) => void;
  className?: string;
}

/** USD / EUR / XOF, styled like the pricing page's billing-period switch. */
export function CurrencySwitch({ value, onChange, className }: CurrencySwitchProps) {
  return (
    <div
      role="group"
      aria-label="Currency"
      className={cn("inline-flex rounded-lg border border-border bg-card p-1 text-sm", className)}
    >
      {CURRENCIES.map((currency) => (
        <button
          key={currency}
          type="button"
          aria-pressed={value === currency}
          onClick={() => onChange(currency)}
          className={cn(
            "rounded-md px-3 py-1.5 outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
            value === currency ? "bg-secondary text-foreground" : "text-muted-foreground hover:text-foreground",
          )}
        >
          {currency}
        </button>
      ))}
    </div>
  );
}
