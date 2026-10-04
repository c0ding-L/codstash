"use client"; // Error boundaries must be Client Components

import { ErrorFallback } from "@/components/dashboard/ErrorFallback";

/** Catches a failing page or section and keeps the sidebar and top bar. */
export default function DashboardError({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  // `unstable_retry` re-fetches and re-renders; `reset` would only clear the
  // error state and re-throw the same failed query.
  return <ErrorFallback error={error} onRetry={unstable_retry} />;
}
