import { ChevronLeft, ChevronRight } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";

import { buttonVariants } from "@/components/ui/button";
import { pageLinks } from "@/lib/pagination";
import { cn } from "@/lib/utils";

interface PaginationProps {
  /** The listing's path without a query, e.g. `/items/snippets`. */
  basePath: string;
  page: number;
  pageCount: number;
  /** The ids listed on this page, read by `useRefreshAfterRemoval`. */
  rowIds: string[];
}

/** Page 1 is the bare path, so the listing has one URL for its first page. */
function pageHref(basePath: string, page: number): string {
  return page === 1 ? basePath : `${basePath}?page=${page}`;
}

/** Prev, numbered page links and next, under a listing. Renders nothing for a single page. */
export function Pagination({ basePath, page, pageCount, rowIds }: PaginationProps) {
  if (pageCount <= 1) return null;

  const hasPrevious = page > 1;
  const hasNext = page < pageCount;

  return (
    <nav
      aria-label="Pagination"
      className="flex justify-center"
      data-pagination=""
      data-page={page}
      data-page-count={pageCount}
      data-row-ids={rowIds.join(" ")}
    >
      <ul className="flex flex-wrap items-center gap-1">
        <li>
          <StepLink
            href={hasPrevious ? pageHref(basePath, page - 1) : null}
            label="Previous"
            icon={<ChevronLeft aria-hidden />}
          />
        </li>

        {pageLinks(page, pageCount).map((link, index) =>
          link === "ellipsis" ? (
            <li key={`ellipsis-${index}`} aria-hidden className="px-1.5 text-sm text-muted-foreground">
              …
            </li>
          ) : (
            <li key={link}>
              <Link
                href={pageHref(basePath, link)}
                aria-current={link === page ? "page" : undefined}
                aria-label={`Page ${link}`}
                className={cn(
                  buttonVariants({ variant: link === page ? "outline" : "ghost", size: "icon" }),
                  "tabular-nums",
                )}
              >
                {link}
              </Link>
            </li>
          ),
        )}

        <li>
          <StepLink
            href={hasNext ? pageHref(basePath, page + 1) : null}
            label="Next"
            icon={<ChevronRight aria-hidden />}
            iconAfter
          />
        </li>
      </ul>
    </nav>
  );
}

interface StepLinkProps {
  /** Null when there is no page that way: the control renders greyed out and inert. */
  href: string | null;
  label: string;
  icon: ReactNode;
  iconAfter?: boolean;
}

function StepLink({ href, label, icon, iconAfter = false }: StepLinkProps) {
  const className = cn(buttonVariants({ variant: "ghost" }), "gap-1");
  const content = iconAfter ? (
    <>
      {label}
      {icon}
    </>
  ) : (
    <>
      {icon}
      {label}
    </>
  );

  if (href === null) {
    return (
      <span aria-disabled="true" className={cn(className, "pointer-events-none opacity-50")}>
        {content}
      </span>
    );
  }

  return (
    <Link href={href} className={className}>
      {content}
    </Link>
  );
}
