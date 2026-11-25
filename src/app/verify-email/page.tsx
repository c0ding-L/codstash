import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { connection } from "next/server";

import { AuthCard } from "@/components/auth/AuthCard";
import { ResendVerificationButton } from "@/components/auth/ResendVerificationButton";
import { buttonVariants } from "@/components/ui/button";
import { isEmailVerificationEnabled } from "@/lib/email-verification-flag";
import { verifyEmailToken } from "@/lib/verification";

export default async function VerifyEmailPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string; email?: string }>;
}) {
  // Rendered per request: this page consumes the token.
  await connection();

  const [{ token, email }, t] = await Promise.all([searchParams, getTranslations("auth.verify")]);
  const verified =
    typeof token === "string" && typeof email === "string" && (await verifyEmailToken(email, token));

  if (verified) {
    return (
      // No language toggle: switching refreshes the page, which would spend the token again and
      // read as "invalid".
      <AuthCard title={t("verifiedTitle")} description={t("verifiedDescription")} languageToggle={false}>
        <Link href="/sign-in" className={buttonVariants({ size: "lg" })}>
          {t("continue")}
        </Link>
      </AuthCard>
    );
  }

  return (
    <AuthCard
      languageToggle={false}
      title={t("invalidTitle")}
      description={t("invalidDescription")}
    >
      {isEmailVerificationEnabled() && typeof email === "string" && email ? (
        <ResendVerificationButton email={email} />
      ) : (
        <Link href="/sign-in" className={buttonVariants({ variant: "outline", size: "lg" })}>
          {t("goToSignIn")}
        </Link>
      )}
    </AuthCard>
  );
}
