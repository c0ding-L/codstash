import { ArrowUpRight } from "lucide-react";
import { getLocale, getTranslations } from "next-intl/server";
import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";

import { TagBadges } from "@/components/items/TagBadges";
import { TypeIconTile } from "@/components/items/TypeIconTile";
import { PublicCopyButton } from "@/components/share/PublicCopyButton";
import { getTypeView } from "@/i18n/labels-server";
import type { SharedItem } from "@/lib/db/share";
import { highlightCode } from "@/lib/highlight";
import { cn, isWebUrl } from "@/lib/utils";

const PLUGINS = [remarkGfm];

/**
 * Links in shared Markdown leave the page in a new tab, marked as user content. react-markdown
 * renders no raw HTML and drops unsafe protocols such as `javascript:`.
 */
const markdownComponents: Components = {
  a: ({ href, title, children }) => (
    <a href={href} title={title} target="_blank" rel="nofollow ugc noopener noreferrer">
      {children}
    </a>
  ),
};

/** Code types render highlighted; everything else that has content is Markdown. */
const CODE_TYPES = new Set(["snippet", "command"]);

async function ItemBody({ item, systemSlug }: { item: SharedItem; systemSlug: string | null }) {
  const t = await getTranslations("publicShare");

  if (systemSlug === "link") {
    if (!item.url) return null;
    return isWebUrl(item.url) ? (
      <a
        href={item.url}
        target="_blank"
        rel="nofollow ugc noopener noreferrer"
        className="inline-flex max-w-full items-center gap-1 font-mono text-sm break-all text-primary underline-offset-4 hover:underline"
        aria-label={`${t("openLink")}: ${item.url}`}
      >
        {item.url}
        <ArrowUpRight className="size-3.5 shrink-0" aria-hidden />
      </a>
    ) : (
      // Not a web address: shown as text, never as a link.
      <p className="font-mono text-sm break-all text-muted-foreground">{item.url}</p>
    );
  }

  if (!item.content) return null;

  if (systemSlug && CODE_TYPES.has(systemSlug)) {
    const html = await highlightCode(item.content, item.language ?? (systemSlug === "command" ? "bash" : null));
    // Shiki's HTML: the code is escaped by Shiki.
    return (
      <div
        className="snippet-code shared-code rounded-lg border border-border bg-[#1e1e1e] p-4"
        dangerouslySetInnerHTML={{ __html: html }}
      />
    );
  }

  return (
    <div className="rounded-lg border border-border bg-[#1e1e1e] px-4 py-3">
      <div className="markdown-preview">
        <ReactMarkdown remarkPlugins={PLUGINS} components={markdownComponents}>
          {item.content}
        </ReactMarkdown>
      </div>
    </div>
  );
}

/**
 * One shared item, read-only, as written by its owner: nothing here is translated but the
 * labels. `headingLevel` is 1 on an item's own page, 2 inside a collection.
 */
export async function SharedItemView({ item, headingLevel = 2 }: { item: SharedItem; headingLevel?: 1 | 2 }) {
  const [typeView, t, locale] = await Promise.all([getTypeView(), getTranslations("publicShare"), getLocale()]);
  const view = typeView(item.type);
  const Heading = headingLevel === 1 ? "h1" : "h2";
  const copyText = item.content || item.url;

  return (
    <article className="flex min-w-0 flex-col gap-3">
      <div className="flex items-start gap-3">
        <TypeIconTile icon={view.Icon} color={view.color} className="size-9 shrink-0 rounded-lg" iconClassName="size-4" />
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <Heading className={cn("font-semibold break-words", headingLevel === 1 ? "text-2xl" : "text-lg")}>
            {item.title}
          </Heading>
          <p className="text-xs text-muted-foreground">
            {view.label}
            {item.language ? ` · ${item.language}` : null}
            {" · "}
            {t("updated", { date: new Intl.DateTimeFormat(locale, { dateStyle: "medium" }).format(item.updatedAt) })}
          </p>
        </div>
        {copyText ? <PublicCopyButton text={copyText} title={item.title} /> : null}
      </div>

      {item.description ? <p className="text-muted-foreground">{item.description}</p> : null}

      <ItemBody item={item} systemSlug={view.systemSlug} />

      {item.tags.length > 0 ? <TagBadges tags={item.tags} /> : null}
    </article>
  );
}
