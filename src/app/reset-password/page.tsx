import Link from "next/link";
import { getTranslations } from "next-intl/server";
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

  const [{ token, email }, t] = await Promise.all([searchParams, getTranslations("auth.reset")]);
  const valid =
    typeof token === "string" && typeof email === "string" && (await isPasswordResetTokenValid(email, token));

  if (!valid) {
    return (
      <AuthCard
        title={t("invalidTitle")}
        description={t("invalidDescription")}
      >
        <Link href="/forgot-password" className={buttonVariants({ size: "lg" })}>
          {t("newLink")}
        </Link>
      </AuthCard>
    );
  }

  return (
    <AuthCard title={t("title")} description={t("forEmail", { email })}>
      <ResetPasswordForm email={email} token={token} />
    </AuthCard>
  );
}
