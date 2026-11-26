import { Crown } from "lucide-react";
import Link from "next/link";
import { getTranslations } from "next-intl/server";

import { ExportButtons } from "@/components/settings/ExportButtons";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

/**
 * Settings › Data: the two export downloads for Pro users, the upgrade link for Free ones.
 * `/api/export` checks the plan again.
 */
export async function ExportDataCard({ isPro }: { isPro: boolean }) {
  const t = await getTranslations("settings.data");
  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("exportTitle")}</CardTitle>
        <CardDescription>{t("exportDescription")}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {isPro ? (
          <>
            <ExportButtons />
            <p className="text-sm text-muted-foreground">{t("zipNote")}</p>
          </>
        ) : (
          <div className="flex flex-wrap items-center gap-3">
            <p className="text-sm text-muted-foreground">{t("proOnly")}</p>
            <Link href="/upgrade" className={cn(buttonVariants({ variant: "outline" }), "gap-2")}>
              <Crown className="text-amber-400" aria-hidden />
              {t("upgrade")}
            </Link>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
