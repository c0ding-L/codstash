"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { refreshPaymentStatus } from "@/actions/billing";

const INTERVAL_MS = 3_000;
const MAX_ATTEMPTS = 10;

/**
 * Re-reads a PENDING payment every 3 s while the webhook is on its way, then
 * re-renders the server page once it settles, or after the last attempt.
 */
interface PaymentStatusPollerProps {
  reference: string;
  /**
   * The row is FAILED but Bictorys reported the checkout as paid: FAILED is
   * then the earlier declined attempt, not the outcome, so keep waiting.
   */
  awaitSuccess?: boolean;
}

export function PaymentStatusPoller({ reference, awaitSuccess = false }: PaymentStatusPollerProps) {
  const router = useRouter();
  const [gaveUp, setGaveUp] = useState(false);

  useEffect(() => {
    let attempts = 0;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout>;

    async function poll() {
      attempts += 1;
      // A failed read counts as "still pending", so one network blip does not end the wait.
      const { status } = await refreshPaymentStatus(reference).catch(() => ({ status: null }));
      if (cancelled) return;
      const settled =
        status === "SUCCEEDED" || status === "NEEDS_REVIEW" || (status === "FAILED" && !awaitSuccess);
      if (settled || attempts >= MAX_ATTEMPTS) {
        if (!settled) setGaveUp(true);
        router.refresh();
        return;
      }
      timer = setTimeout(poll, INTERVAL_MS);
    }

    timer = setTimeout(poll, INTERVAL_MS);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [reference, router, awaitSuccess]);

  return gaveUp ? (
    <p className="text-sm text-muted-foreground">
      This is taking longer than usual. You can leave this page: Pro is added as soon as the payment is confirmed.
    </p>
  ) : null;
}
