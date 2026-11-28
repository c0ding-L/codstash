import { getTranslations } from "next-intl/server";

import { ProOnlyUpgrade } from "@/components/billing/ProOnlyUpgrade";
import { ExportButtons } from "@/components/settings/ExportButtons";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

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
          <ProOnlyUpgrade message={t("proOnly")} label={t("upgrade")} />
        )}
      </CardContent>
    </Card>
  );
}
