import { Crown } from "lucide-react";
import Link from "next/link";

import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * Why a feature is locked, and the way to `/upgrade`. Plain props and no hooks, so a server
 * and a client component can both render it with their own translations.
 */
export function ProOnlyUpgrade({ message, label }: { message: string; label: string }) {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <p className="text-sm text-muted-foreground">{message}</p>
      <Link href="/upgrade" className={cn(buttonVariants({ variant: "outline" }), "gap-2")}>
        <Crown className="text-amber-400" aria-hidden />
        {label}
      </Link>
    </div>
  );
}
