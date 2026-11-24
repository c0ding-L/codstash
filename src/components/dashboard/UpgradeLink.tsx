import { Sparkles } from "lucide-react";
import Link from "next/link";

import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * The top bar's link to `/upgrade`, for Free users only. A ghost button in
 * muted text, quieter than the New buttons beside it; icon-only on mobile.
 */
export async function UpgradeLink({ show }: { show: Promise<boolean> }) {
  if (!(await show)) return null;
  return (
    <Link
      href="/upgrade"
      aria-label="Upgrade"
      className={cn(buttonVariants({ variant: "ghost", size: "sm" }), "text-muted-foreground")}
    >
      <Sparkles aria-hidden />
      <span className="hidden sm:inline">Upgrade</span>
    </Link>
  );
}
