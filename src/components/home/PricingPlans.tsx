"use client";

import { Check, X } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import { CurrencySwitch } from "@/components/billing/CurrencySwitch";
import { buttonVariants } from "@/components/ui/button";
import { BILLING_PLANS, DEFAULT_CURRENCY, PAYMENT_METHODS, formatPrice, type Currency } from "@/lib/billing-plans";
import { cn } from "@/lib/utils";

type Billing = "monthly" | "yearly";

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

/**
 * Free and Pro side by side, with monthly / yearly and currency switches for
 * the Pro price. Display only: the currency is passed to Settings, not stored.
 */
export function PricingPlans() {
  const [billing, setBilling] = useState<Billing>("monthly");
  const [currency, setCurrency] = useState<Currency>(DEFAULT_CURRENCY);

  const price = (billing === "monthly" ? BILLING_PLANS.MONTHLY : BILLING_PLANS.YEARLY).price[currency];
  // Whole units for XOF; cents otherwise ($5.25).
  const perMonth = BILLING_PLANS.YEARLY.price[currency] / 12;
  const perMonthLabel =
    currency === "XOF"
      ? formatPrice(Math.round(perMonth), currency)
      : new Intl.NumberFormat("en-US", { style: "currency", currency, maximumFractionDigits: 2 }).format(perMonth);

  return (
    <div>
      <div className="flex flex-wrap items-center justify-center gap-3">
        <div
          role="group"
          aria-label="Billing period"
          className="inline-flex rounded-lg border border-border bg-card p-1 text-sm"
        >
          {(["monthly", "yearly"] as const).map((option) => (
            <button
              key={option}
              type="button"
              aria-pressed={billing === option}
              onClick={() => setBilling(option)}
              className={cn(
                "flex items-center gap-1.5 rounded-md px-4 py-1.5 capitalize outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
                billing === option ? "bg-secondary text-foreground" : "text-muted-foreground hover:text-foreground",
              )}
            >
              {option}
              {option === "yearly" ? <span className="text-xs text-emerald-400">Save 25%</span> : null}
            </button>
          ))}
        </div>
        <CurrencySwitch value={currency} onChange={setCurrency} />
      </div>
      <p className="mt-3 text-center text-xs text-muted-foreground">
        {PAYMENT_METHODS[currency]}
        {currency === "XOF" ? " (West Africa)" : null}
      </p>

      <div className="mx-auto mt-12 grid max-w-4xl gap-5 md:grid-cols-2">
        <div className="flex flex-col rounded-2xl border border-border bg-card/60 p-8">
          <h3 className="font-medium">Free</h3>
          <p className="mt-4 flex items-baseline gap-1">
            <span className="text-4xl font-semibold tracking-tight">$0</span>
            <span className="text-muted-foreground">/forever</span>
          </p>
          <ul className="mt-8 flex-1 space-y-3 text-sm">
            {freeFeatures.map((feature) => (
              <li
                key={feature.label}
                className={cn("flex items-center gap-3", !feature.included && "text-muted-foreground")}
              >
                {feature.included ? (
                  <Check className="size-4 text-emerald-400" aria-hidden />
                ) : (
                  <X className="size-4" aria-hidden />
                )}
                {feature.label}
              </li>
            ))}
          </ul>
          <Link href="/register" className={cn(buttonVariants({ variant: "outline", size: "lg" }), "mt-8 h-9")}>
            Get Started
          </Link>
        </div>

        <div className="relative flex flex-col rounded-2xl border border-neutral-500 bg-card p-8 shadow-2xl shadow-black/50">
          <span className="absolute -top-3 left-8 rounded-full bg-primary px-3 py-0.5 text-xs font-medium text-primary-foreground">
            Most Popular
          </span>
          <h3 className="font-medium">Pro</h3>
          {/* The monthly figure goes on its own line: "36 000 FCFA" leaves no room beside it. */}
          <p className="mt-4 flex flex-wrap items-baseline gap-x-1 gap-y-1">
            <span className="text-4xl font-semibold tracking-tight whitespace-nowrap">{formatPrice(price, currency)}</span>
            <span className="text-muted-foreground">/{billing === "monthly" ? "month" : "year"}</span>
            {billing === "yearly" ? (
              <span className="w-full text-sm text-muted-foreground">{perMonthLabel}/month</span>
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
          {/* Signed-out visitors go through sign-in, which returns them to Settings (the hash is lost, but Plan is the first section). */}
          <Link href={`/settings?currency=${currency}#plan`} className={cn(buttonVariants({ size: "lg" }), "mt-8 h-9")}>
            Get Pro
          </Link>
        </div>
      </div>
    </div>
  );
}
