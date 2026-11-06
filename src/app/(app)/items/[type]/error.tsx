"use client"; // Error boundaries must be Client Components

import { ErrorFallback } from "@/components/dashboard/ErrorFallback";

/** Catches a failing items query and keeps the sidebar and top bar. */
export default function ItemsError({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  return <ErrorFallback error={error} onRetry={unstable_retry} />;
}
