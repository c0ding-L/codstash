import { getTranslations } from "next-intl/server";

import { ImportPanel } from "@/components/settings/ImportPanel";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { FREE_LIMITS, type PlanUsage } from "@/lib/usage-limits";

/**
 * Settings › Data: importing a Cortex export, loose files or GitHub gists. Free users can
 * import within their limits, shown before they start; the routes enforce them.
 */
export async function ImportDataCard({ plan }: { plan: PlanUsage }) {
  const t = await getTranslations("settings.import");
  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("title")}</CardTitle>
        <CardDescription>{t("description")}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {plan.isPro ? null : (
          <p className="text-sm text-muted-foreground">{t("usage", { used: plan.items, max: FREE_LIMITS.items })}</p>
        )}
        <ImportPanel />
      </CardContent>
    </Card>
  );
}
