"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

import { HomeLogo } from "./HomeLogo";

/** Fixed top bar; transparent over the hero, opaque with a border once the page scrolls. */
export function HomeNav() {
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
      <nav className="mx-auto flex h-14 max-w-6xl items-center gap-6 px-4 sm:px-6">
        <HomeLogo />

        <div className="hidden items-center gap-5 text-sm text-muted-foreground sm:flex">
          <a href="#features" className="py-2 hover:text-foreground">
            Features
          </a>
          <a href="#pricing" className="py-2 hover:text-foreground">
            Pricing
          </a>
        </div>

        <div className="ml-auto flex items-center gap-2">
          <Link href="/sign-in" className={buttonVariants({ variant: "ghost" })}>
            Sign In
          </Link>
          <Link href="/register" className={buttonVariants()}>
            Get Started
          </Link>
        </div>
      </nav>
    </header>
  );
}
