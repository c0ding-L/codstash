import Link from "next/link";
import { connection } from "next/server";

import { AuthCard } from "@/components/auth/AuthCard";
import { ResendVerificationButton } from "@/components/auth/ResendVerificationButton";
import { buttonVariants } from "@/components/ui/button";
import { verifyEmailToken } from "@/lib/verification";

export default async function VerifyEmailPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string; email?: string }>;
}) {
  // Rendered per request: this page consumes the token.
  await connection();

  const { token, email } = await searchParams;
  const verified =
    typeof token === "string" && typeof email === "string" && (await verifyEmailToken(email, token));

  if (verified) {
    return (
      <AuthCard title="Email verified" description="Your account is active. You can now sign in.">
        <Link href="/sign-in" className={buttonVariants({ size: "lg" })}>
          Continue to sign in
        </Link>
      </AuthCard>
    );
  }

  return (
    <AuthCard
      title="Link invalid or expired"
      description="This verification link was already used, has expired, or is not valid."
    >
      {typeof email === "string" && email ? (
        <ResendVerificationButton email={email} />
      ) : (
        <Link href="/sign-in" className={buttonVariants({ variant: "outline", size: "lg" })}>
          Go to sign in
        </Link>
      )}
    </AuthCard>
  );
}
