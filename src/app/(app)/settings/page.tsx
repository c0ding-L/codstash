import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";

import { auth } from "@/auth";
import { ChangePasswordDialog } from "@/components/profile/ChangePasswordDialog";
import { DeleteAccountDialog } from "@/components/profile/DeleteAccountDialog";
import { EditorPreferencesForm } from "@/components/settings/EditorPreferencesForm";
import { UpgradeButtons } from "@/components/settings/UpgradeButtons";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { formatProUntil, parseCurrency } from "@/lib/billing-plans";
import { getPlanStatus } from "@/lib/db/billing";
import { DEMO_USER_EMAIL } from "@/lib/db/collections";
import { getProfile } from "@/lib/db/profile";
import { FREE_LIMITS } from "@/lib/usage-limits";

export const metadata: Metadata = {
  title: "Settings · Cortex",
};

interface SettingsPageProps {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

export default async function SettingsPage({ searchParams }: SettingsPageProps) {
  // Rendered per request, like every other page.
  await connection();

  // The proxy already guards `/settings`; this also covers a JWT whose user row
  // was deleted, which the proxy cannot see.
  const session = await auth();
  const profile = session?.user?.id ? await getProfile(session.user.id) : null;
  if (!profile) redirect("/sign-in?callbackUrl=/settings");

  // `?currency=` comes from the pricing page's "Get Pro" link.
  const [plan, { currency }] = await Promise.all([getPlanStatus(profile.id), searchParams]);

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-8">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold">Settings</h1>
        <p className="text-sm text-muted-foreground">Manage your plan, your editor, your password and your account.</p>
      </div>

      <section id="plan" className="flex scroll-mt-20 flex-col gap-4">
        <h2 className="text-lg font-semibold">Plan</h2>
        <Card>
          <CardHeader>
            <CardTitle>{plan.isPro && plan.proUntil ? `Pro until ${formatProUntil(plan.proUntil)}` : "Free"}</CardTitle>
            <CardDescription>
              {plan.isPro
                ? "Pay again at any time: the new period starts when the current one ends."
                : `${plan.items}/${FREE_LIMITS.items} items, ${plan.collections}/${FREE_LIMITS.collections} collections. Pro removes the limits and adds file and image uploads.`}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <UpgradeButtons initialCurrency={parseCurrency(currency)} isPro={plan.isPro} />
          </CardContent>
        </Card>
      </section>

      <section className="flex flex-col gap-4">
        <h2 className="text-lg font-semibold">Editor</h2>
        <Card>
          <CardHeader>
            <CardTitle>Code editor</CardTitle>
            <CardDescription>Applies to every code editor and viewer. Changes save automatically.</CardDescription>
          </CardHeader>
          <CardContent>
            <Suspense fallback={<Skeleton className="h-64 w-full" />}>
              <EditorPreferencesForm />
            </Suspense>
          </CardContent>
        </Card>
      </section>

      <section className="flex flex-col gap-4">
        <h2 className="text-lg font-semibold">Account</h2>
        <Card>
          <CardHeader>
            <CardTitle>Password</CardTitle>
            <CardDescription>
              {profile.hasPassword
                ? "Change the password you use to sign in with your email."
                : "You sign in with GitHub, so there is no password to change."}
            </CardDescription>
          </CardHeader>
          {profile.hasPassword ? (
            <CardContent>
              <ChangePasswordDialog />
            </CardContent>
          ) : null}
        </Card>

        <Card className="ring-destructive/40">
          <CardHeader>
            <CardTitle>Delete account</CardTitle>
            <CardDescription>
              Permanently deletes your account, your items, collections and tags. This cannot be undone.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <DeleteAccountDialog
              email={profile.email}
              isDemo={profile.email === DEMO_USER_EMAIL}
              hasPassword={profile.hasPassword}
            />
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
