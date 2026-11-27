import { Sparkles } from "lucide-react";
import Link from "next/link";
import { getTranslations } from "next-intl/server";

import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * The top bar's link to `/upgrade`, for Free users only. A ghost button in
 * muted text, quieter than the New buttons beside it; icon-only on mobile.
 */
export async function UpgradeLink({ show }: { show: Promise<boolean> }) {
  if (!(await show)) return null;
  const t = await getTranslations("nav");
  return (
    <Link
      href="/upgrade"
      aria-label={t("upgrade")}
      className={cn(buttonVariants({ variant: "ghost", size: "sm" }), "text-muted-foreground")}
    >
      <Sparkles aria-hidden />
      <span className="hidden xl:inline">{t("upgrade")}</span>
    </Link>
  );
}
