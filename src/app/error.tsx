"use client"; // Error boundaries must be Client Components

import { ErrorFallback } from "@/components/dashboard/ErrorFallback";

/**
 * One segment above `dashboard/`, so it also catches a failure inside the
 * dashboard layout — `AppSidebar` queries the database there, and
 * `dashboard/error.tsx` does not wrap its own segment's layout.
 */
export default function AppError({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  return (
    <main className="mx-auto flex min-h-svh max-w-md items-center p-6">
      <ErrorFallback error={error} onRetry={unstable_retry} />
    </main>
  );
}
