"use client";

import { useRouter } from "next/navigation";

import { pageAfterRemoval } from "@/lib/pagination";

/**
 * Refreshes the current page after a row may have left the listing: deleted, or
 * edited out of the collection shown. When `removedId` was the only row on the
 * last page, it goes back one page instead: refreshing would land on that page's
 * 404. Pass null when nothing left the listing. The listing state comes from the
 * `Pagination` nav, which only renders when there is more than one page.
 */
export function useRefreshAfterRemoval(): (removedId: string | null) => void {
  const router = useRouter();

  return (removedId) => {
    const nav = document.querySelector<HTMLElement>("nav[data-pagination]");
    const target =
      nav && removedId !== null
        ? pageAfterRemoval(
            Number(nav.dataset.page),
            Number(nav.dataset.pageCount),
            (nav.dataset.rowIds ?? "").split(" ").filter(Boolean),
            removedId,
          )
        : null;

    if (target === null) {
      router.refresh();
      return;
    }

    const url = new URL(window.location.href);
    if (target === 1) url.searchParams.delete("page");
    else url.searchParams.set("page", String(target));
    router.replace(url.pathname + url.search);
  };
}
