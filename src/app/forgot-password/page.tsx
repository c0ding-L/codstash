import { getTranslations } from "next-intl/server";
import { connection } from "next/server";

import { AuthCard } from "@/components/auth/AuthCard";
import { ForgotPasswordForm } from "@/components/auth/ForgotPasswordForm";

export default async function ForgotPasswordPage() {
  // Rendered per request, like every other page.
  await connection();
  const t = await getTranslations("auth.forgot");

  return (
    <AuthCard title={t("title")} description={t("description")}>
      <ForgotPasswordForm />
    </AuthCard>
  );
}
