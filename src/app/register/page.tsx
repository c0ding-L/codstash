import { connection } from "next/server";

import { AuthCard } from "@/components/auth/AuthCard";
import { RegisterForm } from "@/components/auth/RegisterForm";

export default async function RegisterPage() {
  // Rendered per request, like every other page.
  await connection();

  return (
    <AuthCard title="Create your account" description="Register with your email and a password.">
      <RegisterForm />
    </AuthCard>
  );
}
