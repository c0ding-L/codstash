import { getTranslations } from "next-intl/server";
import { connection } from "next/server";

import { AuthCard } from "@/components/auth/AuthCard";
import { RegisterForm } from "@/components/auth/RegisterForm";

export default async function RegisterPage() {
  // Rendered per request, like every other page.
  await connection();
  const t = await getTranslations("auth.register");

  return (
    <AuthCard withNav title={t("title")} description={t("description")}>
      <RegisterForm />
    </AuthCard>
  );
}
