import Link from "next/link";
import { getTranslations } from "next-intl/server";

import { HomeNav } from "@/components/home/HomeNav";

/** The public share pages (D1): the homepage's top bar, the content, and a footer that brings visitors to Cortex. */
export default async function SharedLayout({ children }: { children: React.ReactNode }) {
  const t = await getTranslations("publicShare");
  return (
    <div className="flex min-h-svh flex-col">
      <HomeNav />
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 pt-24 pb-16 sm:px-6">{children}</main>
      <footer className="border-t border-border px-4 py-8 sm:px-6">
        <div className="mx-auto flex max-w-3xl flex-wrap items-center justify-between gap-3 text-sm text-muted-foreground">
          <span>{t("footer")}</span>
          <Link href="/register" className="font-medium text-primary underline-offset-4 hover:underline">
            {t("footerCta")}
          </Link>
        </div>
      </footer>
    </div>
  );
}
