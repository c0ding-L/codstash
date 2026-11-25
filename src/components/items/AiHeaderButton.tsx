"use client";

import { Crown, Loader2, Sparkles } from "lucide-react";
import Link from "next/link";
import { use } from "react";

import { Button, buttonVariants } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

const PRO_ONLY_HINT = "AI features require Pro subscription";

interface AiHeaderButtonProps {
  /** From the server's plan check. */
  aiAllowed: Promise<boolean>;
  /** The button's text, e.g. "Explain". */
  label: string;
  /** Its text while the request runs, e.g. "Explaining…". */
  pendingLabel: string;
  /** The Pro user's tooltip: what the button does, and that it sends the content to an AI provider. */
  hint: string;
  pending: boolean;
  disabled: boolean;
  onClick: () => void;
}

/**
 * An AI button for an editor's header (Explain, Optimize) for Pro users; for Free users, a crown
 * linking to `/upgrade` (the drawer closes on the new page). The tooltip hangs on a wrapper because
 * a disabled button takes no pointer events. The action checks the plan again. Suspends on
 * `aiAllowed`, so it goes inside a `Suspense`.
 */
export function AiHeaderButton({ aiAllowed, label, pendingLabel, hint, pending, disabled, onClick }: AiHeaderButtonProps) {
  const allowed = use(aiAllowed);
  return (
    <Tooltip>
      <TooltipTrigger render={<span className="inline-flex" />}>
        {allowed ? (
          <Button type="button" variant="ghost" size="xs" disabled={pending || disabled} onClick={onClick}>
            {pending ? (
              <Loader2 className="animate-spin text-violet-400" aria-hidden />
            ) : (
              <Sparkles className="text-violet-400" aria-hidden />
            )}
            {pending ? pendingLabel : label}
          </Button>
        ) : (
          <Link
            href="/upgrade"
            aria-label={`${label}: ${PRO_ONLY_HINT}. Upgrade`}
            className={buttonVariants({ variant: "ghost", size: "xs" })}
          >
            <Crown className="text-amber-400" aria-hidden />
            {label}
          </Link>
        )}
      </TooltipTrigger>
      <TooltipContent side="bottom">{allowed ? hint : PRO_ONLY_HINT}</TooltipContent>
    </Tooltip>
  );
}
