import { useTranslations } from "next-intl";

import { ItemCopyButton } from "@/components/items/ItemCopyButton";
import { ItemDrawerTrigger } from "@/components/items/ItemDrawerTrigger";
import { ItemStatusMarkers } from "@/components/items/ItemStatusMarkers";
import type { DashboardItem, PromptPreview } from "@/lib/db/items";
import { useRelativeTime } from "@/i18n/labels";

interface PromptListProps {
  items: DashboardItem[];
  previews: Record<string, PromptPreview>;
  /** Passed in so every entry measures against the same moment. */
  now: string;
}

const EMPTY_PREVIEW: PromptPreview = { excerpt: "", words: 0, tokens: 0, tags: [], variables: 0 };

/** The prompt list: a reading column, each prompt's own words quoted, ready to copy. */
export function PromptList({ items, previews, now }: PromptListProps) {
  return (
    <ul className="flex flex-col gap-2">
      {items.map((item) => (
        <PromptEntry key={item.id} item={item} preview={previews[item.id] ?? EMPTY_PREVIEW} now={now} />
      ))}
    </ul>
  );
}

function PromptEntry({ item, preview, now }: { item: DashboardItem; preview: PromptPreview; now: string }) {
  const t = useTranslations("items");
  const tv = useTranslations("variables");
  const relativeTime = useRelativeTime();
  const quote = preview.excerpt || item.description;

  return (
    <li className="group relative rounded-lg px-4 py-4 transition-colors hover:bg-foreground/[0.03]">
      <ItemDrawerTrigger item={item} />

      <div className="flex items-center gap-1.5">
        <h2 className="truncate font-medium">{item.title}</h2>
        <ItemStatusMarkers item={item} />
        {preview.variables > 0 ? (
          <span className="shrink-0 rounded border border-amber-400/30 bg-amber-400/10 px-1 font-mono text-[10px] leading-4 text-amber-500 dark:text-amber-300">
            <span aria-hidden>{`{{ }} ${preview.variables}`}</span>
            <span className="sr-only">{tv("count", { count: preview.variables })}</span>
          </span>
        ) : null}
      </div>

      {quote ? (
        <blockquote className="mt-2 line-clamp-3 border-l-2 border-amber-400/60 pl-4 text-sm leading-relaxed text-muted-foreground transition-colors group-hover:text-foreground">
          {quote}
        </blockquote>
      ) : null}

      <div className="mt-3 flex items-center gap-3">
        {/* Each part keeps its separator and never breaks, so a narrow screen wraps between parts. */}
        <p className="flex min-w-0 flex-1 flex-wrap items-center gap-x-2 gap-y-1 font-mono text-xs text-muted-foreground">
          {preview.tags.map((tag, i) => (
            <span key={tag} className="whitespace-nowrap text-foreground/70">
              #{tag}
              {i === preview.tags.length - 1 ? (
                <span className="text-muted-foreground" aria-hidden>
                  {" "}/
                </span>
              ) : null}
            </span>
          ))}
          <span className="whitespace-nowrap">
            {t("wordCount", { count: preview.words })}
          </span>
          <span className="whitespace-nowrap">
            <span aria-hidden>/ </span>
            {t("tokenCount", { count: preview.tokens })}
          </span>
          <span className="whitespace-nowrap">
            <span aria-hidden>/ </span>
            {relativeTime(item.updatedAt.toISOString(), now)}
          </span>
        </p>
        <ItemCopyButton
          itemId={item.id}
          title={item.title}
          label={t("copyPrompt")}
          type="prompt"
          hasVariables={preview.variables > 0}
          // Hidden until hover only with a mouse: a touch screen, even a wide one, never hovers.
          className="shrink-0 pointer-fine:opacity-0 pointer-fine:group-hover:opacity-100 pointer-fine:focus-visible:opacity-100"
        />
      </div>
    </li>
  );
}
