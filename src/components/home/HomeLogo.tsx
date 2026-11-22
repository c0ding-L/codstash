import { Layers } from "lucide-react";
import Link from "next/link";

/** The landing page mark, from the author's prototype. */
export function HomeLogo() {
  return (
    <Link href="/" className="flex items-center gap-2 rounded-md font-semibold">
      <span className="flex size-7 items-center justify-center rounded-lg bg-primary text-primary-foreground">
        <Layers className="size-4" aria-hidden />
      </span>
      CodStash
    </Link>
  );
}
