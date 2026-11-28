import { useTranslations } from "next-intl";

import { ItemDrawerTrigger } from "@/components/items/ItemDrawerTrigger";
import { ItemStatusMarkers } from "@/components/items/ItemStatusMarkers";
import type { DashboardItem } from "@/lib/db/items";
import { useFileSize, useRelativeTime } from "@/i18n/labels";
import { extensionOf, fileKind } from "@/lib/files";

interface FileListProps {
  items: DashboardItem[];
  /** Passed in so every row measures against the same moment. */
  now: string;
}

/** The smallest bar, so a tiny file still shows a dot next to a large one. */
const MIN_BAR_PERCENT = 3;

/** The file list: a table of name, kind, size and last update, like a file explorer. */
export function FileList({ items, now }: FileListProps) {
  const t = useTranslations("items.fileTable");
  const largest = Math.max(1, ...items.map((item) => item.fileSize ?? 0));

  return (
    <div className="overflow-hidden border-y border-border bg-card">
      <table className="w-full table-fixed text-sm">
        <thead className="border-b border-border text-left text-xs text-muted-foreground">
          <tr>
            <th scope="col" className="px-3 py-2.5 font-medium sm:px-4">
              {t("name")}
            </th>
            <th scope="col" className="hidden w-44 px-4 py-2.5 font-medium sm:table-cell">
              {t("kind")}
            </th>
            <th scope="col" className="w-18 px-3 py-2.5 text-right font-medium sm:w-44 sm:px-4">
              {t("size")}
            </th>
            <th scope="col" className="w-18 px-3 py-2.5 font-medium sm:w-28 sm:px-4">
              {t("updated")}
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {items.map((item) => (
            <FileRow key={item.id} item={item} largest={largest} now={now} />
          ))}
        </tbody>
      </table>
    </div>
  );
}

function FileRow({ item, largest, now }: { item: DashboardItem; largest: number; now: string }) {
  const tk = useTranslations("fileKinds");
  const relativeTime = useRelativeTime();
  const fileSize = useFileSize();
  const name = item.fileName ?? item.title;
  const extension = extensionOf(name).slice(0, 4).toUpperCase() || "FILE";
  const barPercent = item.fileSize
    ? Math.max(MIN_BAR_PERCENT, (item.fileSize / largest) * 100)
    : 0;

  return (
    // `relative` makes the row the overlay's containing block, so the whole row opens the drawer.
    <tr className="relative transition-colors hover:bg-foreground/[0.03]">
      <td className="px-3 py-3 sm:px-4">
        <ItemDrawerTrigger item={item} />
        <div className="flex items-center gap-3">
          <span
            className="flex h-9 w-7 shrink-0 items-end justify-center rounded-sm border border-rose-400/30 bg-rose-400/10 pb-1 font-mono text-[8px] font-semibold text-rose-400"
            aria-hidden
          >
            {extension}
          </span>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <span className="truncate font-mono text-sm">{name}</span>
              {/* Files cannot be shared. */}
              <ItemStatusMarkers item={item} showShared={false} />
            </div>
            {item.description ? (
              <p className="truncate text-xs text-muted-foreground">{item.description}</p>
            ) : null}
          </div>
        </div>
      </td>
      <td className="hidden truncate px-4 py-3 text-muted-foreground sm:table-cell">
        {tk(fileKind(name))}
      </td>
      <td className="px-3 py-3 sm:px-4">
        <div className="flex items-center justify-end gap-3">
          <span className="whitespace-nowrap tabular-nums">
            {item.fileSize ? fileSize(item.fileSize) : "—"}
          </span>
          <span className="hidden h-1 w-16 shrink-0 overflow-hidden rounded-full bg-muted sm:block" aria-hidden>
            <span className="block h-full rounded-full bg-rose-400" style={{ width: `${barPercent}%` }} />
          </span>
        </div>
      </td>
      <td className="px-3 py-3 text-xs whitespace-nowrap text-muted-foreground sm:px-4">
        {relativeTime(item.updatedAt.toISOString(), now)}
      </td>
    </tr>
  );
}
