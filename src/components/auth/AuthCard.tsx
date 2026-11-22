import { HomeNav } from "@/components/home/HomeNav";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

/** Centered card shared by the auth pages. `withNav` adds the homepage top nav above it. */
export function AuthCard({
  title,
  description,
  withNav = false,
  children,
}: Readonly<{
  title: string;
  description: string;
  withNav?: boolean;
  children: React.ReactNode;
}>) {
  return (
    <>
      {withNav && <HomeNav />}
      {/* The nav is fixed and 3.5rem tall, so keep the card clear of it. */}
      <main className={cn("flex min-h-svh items-center justify-center p-6", withNav && "pt-20")}>
        <Card className="w-full max-w-sm">
          <CardHeader>
            <CardTitle className="text-lg font-semibold">{title}</CardTitle>
            <CardDescription>{description}</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4">{children}</CardContent>
        </Card>
      </main>
    </>
  );
}
