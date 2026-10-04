import { connection } from "next/server";

import { AuthCard } from "@/components/auth/AuthCard";
import { ForgotPasswordForm } from "@/components/auth/ForgotPasswordForm";

export default async function ForgotPasswordPage() {
  // Rendered per request, like every other page.
  await connection();

  return (
    <AuthCard title="Forgot your password?" description="We will email you a link to choose a new one.">
      <ForgotPasswordForm />
    </AuthCard>
  );
}
