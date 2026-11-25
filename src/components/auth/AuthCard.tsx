import { HomeNav } from "@/components/home/HomeNav";
import { LanguageToggle } from "@/components/i18n/LanguageToggle";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

/**
 * Centered card shared by the auth pages. `withNav` adds the homepage top nav above it.
 * `languageToggle={false}` hides EN / FR, for a page that must not re-render (switching refreshes it).
 */
export function AuthCard({
  title,
  description,
  withNav = false,
  languageToggle = true,
  children,
}: Readonly<{
  title: string;
  description: string;
  withNav?: boolean;
  languageToggle?: boolean;
  children: React.ReactNode;
}>) {
  return (
    <>
      {withNav && <HomeNav />}
      {/* The nav is fixed and 3.5rem tall, so keep the card clear of it. */}
      <main className={cn("flex min-h-svh flex-col items-center justify-center gap-3 p-6", withNav && "pt-20")}>
        <Card className="w-full max-w-sm">
          <CardHeader>
            <CardTitle className="text-lg font-semibold">{title}</CardTitle>
            <CardDescription>{description}</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4">{children}</CardContent>
        </Card>
        {languageToggle && <LanguageToggle />}
      </main>
    </>
  );
}
