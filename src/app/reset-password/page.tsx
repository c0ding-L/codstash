import Link from "next/link";
import { connection } from "next/server";

import { AuthCard } from "@/components/auth/AuthCard";
import { ResetPasswordForm } from "@/components/auth/ResetPasswordForm";
import { buttonVariants } from "@/components/ui/button";
import { isPasswordResetTokenValid } from "@/lib/password-reset";

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string; email?: string }>;
}) {
  // Rendered per request: the token is checked on every visit.
  await connection();

  const { token, email } = await searchParams;
  const valid =
    typeof token === "string" && typeof email === "string" && (await isPasswordResetTokenValid(email, token));

  if (!valid) {
    return (
      <AuthCard
        title="Link invalid or expired"
        description="This reset link was already used, has expired, or is not valid."
      >
        <Link href="/forgot-password" className={buttonVariants({ size: "lg" })}>
          Send a new reset link
        </Link>
      </AuthCard>
    );
  }

  return (
    <AuthCard title="Choose a new password" description={`For ${email}`}>
      <ResetPasswordForm email={email} token={token} />
    </AuthCard>
  );
}
