"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";

import { LanguageToggle } from "@/components/i18n/LanguageToggle";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

import { HomeLogo } from "./HomeLogo";

/**
 * Fixed top bar; transparent over the hero, opaque with a border once the page scrolls. It carries
 * the EN / FR toggle, so the auth pages that show it hide the one under their card.
 */
export function HomeNav() {
  const t = useTranslations("homeNav");
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header
      className={cn(
        "fixed inset-x-0 top-0 z-50 border-b transition-colors duration-200",
        scrolled ? "border-border bg-background/90 backdrop-blur" : "border-transparent bg-transparent",
      )}
    >
      <nav className="relative mx-auto flex h-14 max-w-6xl items-center gap-3 px-4 sm:gap-6 sm:px-6">
        <HomeLogo />

        {/* Centred on the bar itself, not in the space left between the logo and the buttons. From
            `lg` only: narrower, the French labels and the toggle run into them. The hero and the
            footer link to both sections. */}
        <div className="absolute left-1/2 hidden -translate-x-1/2 items-center gap-5 text-sm text-muted-foreground lg:flex">
          <Link href="/#features" className="py-2 hover:text-foreground">
            {t("features")}
          </Link>
          <Link href="/#pricing" className="py-2 hover:text-foreground">
            {t("pricing")}
          </Link>
        </div>

        {/* Below `sm` there is no room for both buttons and the toggle: "Get Started" goes, since the
            hero's own call to action sits right under the bar. */}
        <div className="ml-auto flex items-center gap-1 sm:gap-2">
          <LanguageToggle />
          <Link href="/sign-in" className={buttonVariants({ variant: "ghost" })}>
            {t("signIn")}
          </Link>
          <Link href="/register" className={cn(buttonVariants(), "hidden sm:inline-flex")}>
            {t("getStarted")}
          </Link>
        </div>
      </nav>
    </header>
  );
}
