import { Lock } from "lucide-react";

import { UpgradeButtons } from "@/components/settings/UpgradeButtons";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { DEFAULT_CURRENCY } from "@/lib/billing-plans";

/** Shown to Free users on the Files and Images pages: uploads are Pro-only. */
export function ProFeatureUpsell() {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Lock className="size-4 shrink-0 text-muted-foreground" aria-hidden />
          Files and images are a Pro feature
        </CardTitle>
        <CardDescription>
          Upgrade to Pro to upload files and images, with no limit on items or collections.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <UpgradeButtons initialCurrency={DEFAULT_CURRENCY} isPro={false} />
      </CardContent>
    </Card>
  );
}
