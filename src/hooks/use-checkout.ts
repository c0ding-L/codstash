"use client";

import { useState, useTransition } from "react";

import { startCheckout } from "@/actions/billing";
import type { Currency, Plan } from "@/lib/billing-plans";

/**
 * Opens the Bictorys checkout for a plan. On success the page navigates away, so `isPending`
 * stays true until it does; a failure sets `error` and calls `onFailure`.
 */
export function useCheckout({ onFailure }: { onFailure?: () => void } = {}) {
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function checkout(plan: Plan, currency: Currency) {
    setError(null);
    startTransition(async () => {
      const result = await startCheckout({ plan, currency });
      if (result.success) {
        // External URL: a full navigation.
        window.location.assign(result.redirectUrl);
        return;
      }
      setError(result.error);
      onFailure?.();
    });
  }

  return { checkout, error, isPending };
}
