import { Globe } from "lucide-react";
import { useTranslations } from "next-intl";

import { cn } from "@/lib/utils";

/** The small globe beside a collection's or an item's name while its public link is on (D1). */
export function SharedBadge({ className }: { className?: string }) {
  const t = useTranslations("share");
  return <Globe className={cn("size-3 shrink-0 text-sky-500", className)} role="img" aria-label={t("badge")} />;
}
