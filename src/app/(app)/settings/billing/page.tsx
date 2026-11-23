import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { connection } from "next/server";

import { auth } from "@/auth";
import { PaymentStatusPoller } from "@/components/settings/PaymentStatusPoller";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { formatProUntil } from "@/lib/billing-plans";
import { findPaymentByReference, getPlanStatus } from "@/lib/db/billing";
import { cn } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Payment · Cortex",
};

interface BillingReturnPageProps {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

const first = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value);

/**
 * Where Bictorys sends the customer back. It only shows the payment's state:
 * the webhook is what grants Pro, never this page.
 */
export default async function BillingReturnPage({ searchParams }: BillingReturnPageProps) {
  await connection();

  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) redirect("/sign-in?callbackUrl=/settings");

  const params = await searchParams;
  const reference = first(params.ref);
  // Bictorys adds `error=1` on its error redirect; without it, the checkout was paid.
  const errored = first(params.error) === "1";

  // Only the signed-in user's own payment; anyone else's reads as not found.
  const found = reference ? await findPaymentByReference(reference) : null;
  const payment = found?.userId === userId ? found : null;

  let title: string;
  let description: string;
  let polling = false;
  let retry = false;

  if (!payment) {
    title = "Payment not found";
    description = "We could not find this payment on your account.";
    retry = true;
  } else if (payment.status === "SUCCEEDED") {
    const { proUntil } = await getPlanStatus(userId);
    title = proUntil ? `You're Pro until ${formatProUntil(proUntil)}` : "You're Pro";
    description = "Thank you! Your payment is confirmed.";
  } else if (payment.status === "NEEDS_REVIEW") {
    title = "We're checking your payment";
    description = "We received your payment and are checking it — contact support if this takes long.";
  } else if (errored) {
    title = "The payment did not go through";
    description = "Your plan has not changed. You can try again with another card or payment method.";
    retry = true;
  } else {
    // PENDING, or FAILED after Bictorys sent the customer back as paid: a
    // declined card then a good one on the same page leaves the row FAILED
    // until the second webhook arrives, so wait for it.
    title = "Confirming your payment…";
    description = "This usually takes a few seconds.";
    polling = true;
  }

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-8">
      <Card>
        <CardHeader>
          <CardTitle>{title}</CardTitle>
          <CardDescription>{description}</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {polling && payment ? (
            <PaymentStatusPoller reference={payment.reference} awaitSuccess={payment.status === "FAILED"} />
          ) : null}
          <div>
            <Link
              href="/settings#plan"
              className={cn(buttonVariants({ variant: retry ? "default" : "outline" }))}
            >
              {retry ? "Try again" : "Back to settings"}
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
