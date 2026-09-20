import { connection } from "next/server";

import { AuthCard } from "@/components/auth/AuthCard";
import { SignInForm } from "@/components/auth/SignInForm";

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ callbackUrl?: string; error?: string }>;
}) {
  // Rendered per request, like every other page.
  await connection();

  const { callbackUrl, error } = await searchParams;

  return (
    <AuthCard title="Sign in to CodStash" description="Use your email and password, or GitHub.">
      <SignInForm
        callbackUrl={callbackUrl ?? "/dashboard"}
        initialError={error ? "Sign in failed. Check your details and try again." : null}
      />
    </AuthCard>
  );
}
