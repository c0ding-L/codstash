"use client";

import { Check, X } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import { buttonVariants } from "@/components/ui/button";
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

/** Free and Pro side by side, with a monthly / yearly switch for the Pro price. */
export function PricingPlans() {
  const [billing, setBilling] = useState<Billing>("monthly");

  return (
    <div>
      <div className="flex justify-center">
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
      </div>

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
          <p className="mt-4 flex items-baseline gap-1">
            <span className="text-4xl font-semibold tracking-tight">{billing === "monthly" ? "$8" : "$72"}</span>
            <span className="text-muted-foreground">/{billing === "monthly" ? "month" : "year"}</span>
            {billing === "yearly" ? <span className="ml-2 text-sm text-muted-foreground">$6/month</span> : null}
          </p>
          <ul className="mt-8 flex-1 space-y-3 text-sm">
            {proFeatures.map((feature) => (
              <li key={feature} className="flex items-center gap-3">
                <Check className="size-4 text-emerald-400" aria-hidden />
                {feature}
              </li>
            ))}
          </ul>
          <Link href="/register" className={cn(buttonVariants({ size: "lg" }), "mt-8 h-9")}>
            Get Pro
          </Link>
        </div>
      </div>
    </div>
  );
}
