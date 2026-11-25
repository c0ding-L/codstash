import { getTranslations } from "next-intl/server";
import { connection } from "next/server";

import { AuthCard } from "@/components/auth/AuthCard";
import { SignInForm } from "@/components/auth/SignInForm";
import { isEmailVerificationEnabled } from "@/lib/email-verification-flag";

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ callbackUrl?: string; error?: string }>;
}) {
  // Rendered per request, like every other page.
  await connection();

  const [{ callbackUrl, error }, t] = await Promise.all([searchParams, getTranslations("auth.signIn")]);

  return (
    <AuthCard withNav title={t("title")} description={t("description")}>
      <SignInForm
        callbackUrl={callbackUrl ?? "/dashboard"}
        verificationEnabled={isEmailVerificationEnabled()}
        initialError={error ? t("failed") : null}
      />
    </AuthCard>
  );
}
