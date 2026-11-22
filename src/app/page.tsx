import { ArrowRight, Search } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";

import { AiSection } from "@/components/home/AiSection";
import { ChaosBox } from "@/components/home/ChaosBox";
import { DashboardPreview } from "@/components/home/DashboardPreview";
import { features } from "@/components/home/home-content";
import { HomeLogo } from "@/components/home/HomeLogo";
import { HomeNav } from "@/components/home/HomeNav";
import { PricingPlans } from "@/components/home/PricingPlans";
import { Reveal } from "@/components/home/Reveal";
import { buttonVariants } from "@/components/ui/button";
import { colorClasses, surfaceClasses, typeColors, typeIcons } from "@/lib/item-type-ui";
import { cn } from "@/lib/utils";

export const metadata: Metadata = {
  title: "CodStash — Developer Knowledge Hub",
  description:
    "Keep your snippets, prompts, commands, notes, files, images and links in one searchable place.",
};

/** The public landing page, shown to everyone. Signing in still lands on `/dashboard`. */
export default async function Home() {
  // Rendered per request like every other page; the footer year comes from it.
  await connection();
  const year = new Date().getFullYear();

  return (
    <>
      <HomeNav />

      <main className="flex-1">
        <section className="relative overflow-hidden px-4 pt-36 pb-24 sm:px-6">
          <div className="pointer-events-none absolute top-0 left-1/2 h-[480px] w-[900px] -translate-x-1/2 rounded-full bg-white/[0.04] blur-3xl" />
          <div className="relative mx-auto max-w-6xl">
            <div className="mx-auto max-w-3xl text-center">
              <h1 className="text-5xl font-semibold tracking-tight md:text-7xl">
                Save It Once.{" "}
                <span className="inline-block text-neutral-500">Find It Forever.</span>
              </h1>
              <p className="mx-auto mt-6 max-w-2xl text-lg text-muted-foreground">
                Stop digging through bash history and old chats. Keep every snippet, prompt, command and link
                in one place, and find any of them in seconds.
              </p>
              <div className="mt-8 flex flex-wrap justify-center gap-3">
                <Link href="/register" className={cn(buttonVariants({ size: "lg" }), "h-10 px-8")}>
                  Get Started Free
                  <ArrowRight aria-hidden />
                </Link>
                <a href="#features" className={cn(buttonVariants({ variant: "outline", size: "lg" }), "h-10 border-foreground/25 px-8 dark:border-foreground/25")}>
                  See Features
                </a>
              </div>
            </div>

            <div className="mt-20 grid items-center gap-6 md:grid-cols-[1fr_auto_1.35fr]">
              <ChaosBox />
              <div className="flex justify-center">
                <div className="arrow-pulse grid size-12 rotate-90 place-items-center rounded-full border border-border bg-card md:rotate-0">
                  <ArrowRight className="size-5" aria-hidden />
                </div>
              </div>
              <DashboardPreview />
            </div>
          </div>
        </section>

        <section id="features" className="scroll-mt-20 border-t border-border px-4 py-28 sm:px-6">
          <div className="mx-auto max-w-6xl">
            <Reveal className="mx-auto max-w-2xl text-center">
              <h2 className="text-4xl font-semibold tracking-tight">One home for everything you know</h2>
              <p className="mt-4 text-muted-foreground">
                From a one-line command to a full design doc, everything is stored, tagged and searchable the same way.
              </p>
            </Reveal>
            <div className="mt-14 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {features.map((feature, index) => {
                const color = feature.type ? typeColors[feature.type] : null;
                const Icon = feature.type ? typeIcons[feature.type] : Search;
                return (
                  <Reveal key={feature.title} delay={index * 60}>
                    <div className="h-full rounded-xl border border-border bg-card p-6 transition-colors hover:border-neutral-700">
                      <div
                        className={cn(
                          "grid size-10 place-items-center rounded-lg",
                          color ? surfaceClasses[color] : "bg-white/10",
                        )}
                      >
                        <Icon className={cn("size-5", color ? colorClasses[color] : "text-neutral-200")} aria-hidden />
                      </div>
                      <h3 className="mt-5 font-medium">{feature.title}</h3>
                      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{feature.description}</p>
                    </div>
                  </Reveal>
                );
              })}
            </div>
          </div>
        </section>

        <AiSection />

        <section id="pricing" className="scroll-mt-20 border-t border-border px-4 py-28 sm:px-6">
          <Reveal className="mx-auto max-w-2xl text-center">
            <h2 className="text-4xl font-semibold tracking-tight">Pricing that scales with you</h2>
            <p className="mt-4 text-muted-foreground">Start on the free plan, upgrade for files, images and AI.</p>
          </Reveal>
          <div className="mt-10">
            <PricingPlans />
          </div>
        </section>

        <section className="border-t border-border px-4 py-28 sm:px-6">
          <Reveal className="mx-auto max-w-3xl rounded-2xl border border-border bg-gradient-to-b from-card to-background px-6 py-16 text-center">
            <h2 className="text-3xl font-semibold tracking-tight text-balance md:text-4xl">
              Never Lose a Snippet Again
            </h2>
            <p className="mt-4 text-muted-foreground">Set up in a minute, find anything in seconds.</p>
            <Link href="/register" className={cn(buttonVariants({ size: "lg" }), "mt-8 h-10 px-8")}>
              Get Started Free
              <ArrowRight aria-hidden />
            </Link>
          </Reveal>
        </section>
      </main>

      <footer className="border-t border-border px-4 py-12 sm:px-6">
        <div className="mx-auto max-w-6xl">
          <div className="flex flex-col gap-10 md:flex-row md:justify-between">
            <div className="max-w-xs">
              <HomeLogo />
              <p className="mt-3 text-sm text-muted-foreground">
                The developer knowledge hub for snippets, prompts, commands and more.
              </p>
            </div>
            <div className="flex gap-16 text-sm">
              <div>
                <h3 className="font-medium">Product</h3>
                <ul className="mt-2 space-y-0.5 text-muted-foreground">
                  <li>
                    <a href="#features" className="inline-block py-1 hover:text-foreground">
                      Features
                    </a>
                  </li>
                  <li>
                    <a href="#pricing" className="inline-block py-1 hover:text-foreground">
                      Pricing
                    </a>
                  </li>
                </ul>
              </div>
              <div>
                <h3 className="font-medium">Account</h3>
                <ul className="mt-2 space-y-0.5 text-muted-foreground">
                  <li>
                    <Link href="/sign-in" className="inline-block py-1 hover:text-foreground">
                      Sign In
                    </Link>
                  </li>
                  <li>
                    <Link href="/register" className="inline-block py-1 hover:text-foreground">
                      Get Started
                    </Link>
                  </li>
                </ul>
              </div>
            </div>
          </div>
          <p className="mt-12 text-xs text-muted-foreground">© {year} CodStash. All rights reserved.</p>
        </div>
      </footer>
    </>
  );
}
