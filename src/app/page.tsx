import { ArrowRight } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { connection } from "next/server";

import { AiSection } from "@/components/home/AiSection";
import { ChaosBox } from "@/components/home/ChaosBox";
import { DashboardPreview } from "@/components/home/DashboardPreview";
import { features } from "@/components/home/home-content";
import { HomeLogo } from "@/components/home/HomeLogo";
import { HomeNav } from "@/components/home/HomeNav";
import { IntegrationsSection } from "@/components/home/IntegrationsSection";
import { PricingPlans } from "@/components/home/PricingPlans";
import { Reveal } from "@/components/home/Reveal";
import { buttonVariants } from "@/components/ui/button";
import { colorClasses, surfaceClasses, typeColors, typeIcons } from "@/lib/item-type-ui";
import { cn } from "@/lib/utils";

/** Fills the `{variables}` placeholder of the feature cards: the template syntax, which ICU messages cannot hold as text. */
const variables = "{{variables}}";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("metadata.home");
  return { title: t("title"), description: t("description") };
}

/** The public landing page, shown to everyone. Signing in still lands on `/dashboard`. */
export default async function Home() {
  // Rendered per request like every other page; the footer year comes from it.
  await connection();
  // A string, so the year is not formatted as a number ("2,026").
  const year = String(new Date().getFullYear());
  const [t, tn] = await Promise.all([getTranslations("home"), getTranslations("homeNav")]);

  return (
    <>
      <HomeNav />

      <main className="flex-1">
        <section className="relative overflow-hidden px-4 pt-36 pb-24 sm:px-6">
          {/* The centring stays on the wrapper; the glows inside drift with `transform` alone. */}
          <div className="pointer-events-none absolute top-0 left-1/2 h-[480px] w-[900px] -translate-x-1/2" aria-hidden>
            <div className="hero-glow absolute inset-0 rounded-full bg-white/[0.06] blur-3xl" />
            <div className="hero-glow-alt absolute top-24 right-0 h-[300px] w-[480px] rounded-full bg-white/[0.05] blur-3xl" />
          </div>
          <div className="relative mx-auto max-w-6xl">
            <div className="mx-auto max-w-3xl text-center">
              <h1 className="text-5xl font-semibold tracking-tight md:text-7xl">
                {t("hero.titleStart")}{" "}
                <span className="inline-block text-neutral-500">{t("hero.titleEnd")}</span>
              </h1>
              <p className="mx-auto mt-6 max-w-2xl text-lg text-muted-foreground">
                {t("hero.subtitle")}
              </p>
              <div className="mt-8 flex flex-wrap justify-center gap-3">
                <Link href="/register" className={cn(buttonVariants({ size: "lg" }), "h-10 px-8")}>
                  {t("hero.getStartedFree")}
                  <ArrowRight aria-hidden />
                </Link>
                <a href="#features" className={cn(buttonVariants({ variant: "outline", size: "lg" }), "h-10 border-foreground/25 px-8 dark:border-foreground/25")}>
                  {t("hero.seeFeatures")}
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
              <h2 className="text-4xl font-semibold tracking-tight">{t("features.title")}</h2>
              <p className="mt-4 text-muted-foreground">{t("features.subtitle")}</p>
            </Reveal>
            <div className="mt-14 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {features.map((feature, index) => {
                const color = "type" in feature ? typeColors[feature.type] : null;
                const Icon = "type" in feature ? typeIcons[feature.type] : feature.icon;
                return (
                  <Reveal key={feature.key} delay={index * 60}>
                    <div className="h-full rounded-xl border border-border bg-card p-6 transition-colors hover:border-neutral-700">
                      <div
                        className={cn(
                          "grid size-10 place-items-center rounded-lg",
                          color ? surfaceClasses[color] : "bg-white/10",
                        )}
                      >
                        <Icon className={cn("size-5", color ? colorClasses[color] : "text-neutral-200")} aria-hidden />
                      </div>
                      <h3 className="mt-5 font-medium">{t(`features.cards.${feature.key}.title`)}</h3>
                      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                        {t(`features.cards.${feature.key}.description`, { variables })}
                      </p>
                    </div>
                  </Reveal>
                );
              })}
            </div>
          </div>
        </section>

        <AiSection />

        <IntegrationsSection />

        <section id="pricing" className="scroll-mt-20 border-t border-border px-4 py-28 sm:px-6">
          <Reveal className="mx-auto max-w-2xl text-center">
            <h2 className="text-4xl font-semibold tracking-tight">{t("pricing.title")}</h2>
            <p className="mt-4 text-muted-foreground">{t("pricing.subtitle")}</p>
          </Reveal>
          <div className="mt-10">
            <PricingPlans />
          </div>
        </section>

        <section className="border-t border-border px-4 py-28 sm:px-6">
          <Reveal className="mx-auto max-w-3xl rounded-2xl border border-border bg-gradient-to-b from-card to-background px-6 py-16 text-center">
            <h2 className="text-3xl font-semibold tracking-tight text-balance md:text-4xl">
              {t("cta.title")}
            </h2>
            <p className="mt-4 text-muted-foreground">{t("cta.subtitle")}</p>
            <Link href="/register" className={cn(buttonVariants({ size: "lg" }), "mt-8 h-10 px-8")}>
              {t("hero.getStartedFree")}
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
                {t("footer.tagline")}
              </p>
            </div>
            <div className="flex gap-16 text-sm">
              <div>
                <h3 className="font-medium">{t("footer.product")}</h3>
                <ul className="mt-2 space-y-0.5 text-muted-foreground">
                  <li>
                    <a href="#features" className="inline-block py-1 hover:text-foreground">
                      {tn("features")}
                    </a>
                  </li>
                  <li>
                    <a href="#pricing" className="inline-block py-1 hover:text-foreground">
                      {tn("pricing")}
                    </a>
                  </li>
                </ul>
              </div>
              <div>
                <h3 className="font-medium">{t("footer.account")}</h3>
                <ul className="mt-2 space-y-0.5 text-muted-foreground">
                  <li>
                    <Link href="/sign-in" className="inline-block py-1 hover:text-foreground">
                      {tn("signIn")}
                    </Link>
                  </li>
                  <li>
                    <Link href="/register" className="inline-block py-1 hover:text-foreground">
                      {tn("getStarted")}
                    </Link>
                  </li>
                </ul>
              </div>
            </div>
          </div>
          <p className="mt-12 text-xs text-muted-foreground">{t("footer.rights", { year })}</p>
        </div>
      </footer>
    </>
  );
}
