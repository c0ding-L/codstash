import { FolderOpen, Layers } from "lucide-react";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { connection } from "next/server";

import { auth } from "@/auth";
import { UserAvatar } from "@/components/auth/UserAvatar";
import { ChangePasswordDialog } from "@/components/profile/ChangePasswordDialog";
import { DeleteAccountDialog } from "@/components/profile/DeleteAccountDialog";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { DEMO_USER_EMAIL } from "@/lib/db/collections";
import { getProfile, getProfileStats } from "@/lib/db/profile";
import { colorClasses, surfaceClasses, typeIcons, typePluralNames } from "@/lib/item-type-ui";
import { cn } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Profile · Codstash",
};

const memberSince = new Intl.DateTimeFormat("en-US", { dateStyle: "long", timeZone: "UTC" });

export default async function ProfilePage() {
  // Rendered per request, like every other page.
  await connection();

  // The proxy already guards `/profile`; this also covers a JWT whose user row
  // was deleted, which the proxy cannot see.
  const session = await auth();
  const profile = session?.user?.id ? await getProfile(session.user.id) : null;
  if (!profile) redirect("/sign-in?callbackUrl=/profile");

  const stats = await getProfileStats(profile.id);
  const totals = [
    { label: "Items", value: stats.totalItems, icon: Layers },
    { label: "Collections", value: stats.collectionCount, icon: FolderOpen },
  ];

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold">Profile</h1>
        <p className="text-sm text-muted-foreground">Your account, your usage, and account settings.</p>
      </div>

      <Card>
        <CardContent className="flex items-center gap-4">
          <UserAvatar
            name={profile.name}
            email={profile.email}
            image={profile.image}
            className="size-16 rounded-xl text-lg"
          />
          <div className="grid min-w-0 gap-0.5">
            <span className="truncate text-lg font-semibold">{profile.name ?? profile.email}</span>
            <span className="truncate text-sm text-muted-foreground">{profile.email}</span>
            <span className="text-xs text-muted-foreground">
              Member since {memberSince.format(profile.createdAt)}
            </span>
          </div>
        </CardContent>
      </Card>

      {/* Side by side on wide screens, so the page uses the width it has. */}
      <div className="grid items-start gap-8 xl:grid-cols-2">
        <section className="flex flex-col gap-4">
          <h2 className="text-lg font-semibold">Usage</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            {totals.map(({ label, value, icon: Icon }) => (
              <Card key={label}>
                <CardContent className="flex flex-col gap-1">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                      {label}
                    </span>
                    <Icon className="size-4 text-muted-foreground" aria-hidden />
                  </div>
                  <span className="text-3xl font-semibold tabular-nums">{value}</span>
                </CardContent>
              </Card>
            ))}
          </div>
          <Card>
            <CardHeader>
              <CardTitle>By type</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="grid gap-2 sm:grid-cols-2">
                {stats.byType.map(({ slug, color, count }) => {
                  const Icon = typeIcons[slug];
                  return (
                    <li key={slug} className="flex items-center gap-3 rounded-lg px-2 py-1.5">
                      <span
                        className={cn(
                          "flex size-8 items-center justify-center rounded-md",
                          color ? surfaceClasses[color] : "bg-muted",
                        )}
                      >
                        <Icon className={cn("size-4", color ? colorClasses[color] : "text-muted-foreground")} aria-hidden />
                      </span>
                      <span className="flex-1">{typePluralNames[slug]}</span>
                      <span className="font-medium tabular-nums">{count}</span>
                    </li>
                  );
                })}
              </ul>
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
              <DeleteAccountDialog email={profile.email} isDemo={profile.email === DEMO_USER_EMAIL} />
            </CardContent>
          </Card>
        </section>
      </div>
    </div>
  );
}
