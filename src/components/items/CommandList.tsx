import { Pin, Star } from "lucide-react";
import { useTranslations } from "next-intl";

import { CommandCopyButton } from "@/components/items/CommandCopyButton";
import { ItemDrawerTrigger } from "@/components/items/ItemDrawerTrigger";
import { SharedBadge } from "@/components/share/SharedBadge";
import { commandFirstLine, tokenizeCommand, type CommandTokenKind } from "@/lib/command-text";
import type { CommandText, DashboardItem } from "@/lib/db/items";
import { useRelativeTime } from "@/i18n/labels";
import { formatCollectionNames } from "@/lib/format";

const tokenClasses: Record<CommandTokenKind, string> = {
  program: "text-cyan-400",
  flag: "text-cyan-200/70",
  operator: "text-muted-foreground",
  string: "text-amber-300",
  plain: "",
};

interface CommandListProps {
  items: DashboardItem[];
  texts: Record<string, CommandText>;
  /** Passed in so every row measures against the same moment. */
  now: string;
}

/** The command list: one terminal window, a commented title and the command per row. */
export function CommandList({ items, texts, now }: CommandListProps) {
  return (
    <div className="overflow-hidden rounded-lg border border-border bg-card">
      <div className="flex items-center gap-3 border-b border-border px-4 py-2.5" aria-hidden>
        <span className="flex gap-1.5">
          <span className="size-2.5 rounded-full bg-muted-foreground/30" />
          <span className="size-2.5 rounded-full bg-muted-foreground/30" />
          <span className="size-2.5 rounded-full bg-muted-foreground/30" />
        </span>
        <span className="font-mono text-xs text-muted-foreground">~/cortex/commands</span>
      </div>

      <ul className="divide-y divide-border">
        {items.map((item) => (
          <CommandRow key={item.id} item={item} command={texts[item.id]} now={now} />
        ))}
      </ul>
    </div>
  );
}

function CommandRow({
  item,
  command = { text: "", isCut: false, hasVariables: false },
  now,
}: {
  item: DashboardItem;
  command?: CommandText;
  now: string;
}) {
  const tc = useTranslations("common");
  const relativeTime = useRelativeTime();
  const collectionNames = formatCollectionNames(item.collections);
  const { line, hasMore } = commandFirstLine(command.text);

  return (
    <li className="group relative flex items-start gap-4 px-4 py-3 transition-colors hover:bg-foreground/[0.03] sm:items-center">
      <ItemDrawerTrigger item={item} />

      <div className="min-w-0 flex-1 font-mono text-sm">
        <p className="truncate text-xs text-muted-foreground"># {item.title}</p>
        <code className="line-clamp-2 wrap-break-word whitespace-pre-wrap sm:block sm:truncate sm:whitespace-pre">
          <span className="text-cyan-400 select-none">$ </span>
          {tokenizeCommand(line).map((token, i) => (
            <span key={i} className={tokenClasses[token.kind]}>
              {token.text}
            </span>
          ))}
          {hasMore ? <span className="text-muted-foreground"> …</span> : null}
        </code>
      </div>

      <div className="flex shrink-0 items-center gap-3 text-xs text-muted-foreground">
        <span>
          {collectionNames ? (
            <span className="hidden sm:inline">{collectionNames} / </span>
          ) : null}
          {relativeTime(item.updatedAt.toISOString(), now)}
        </span>
        {item.isShared ? <SharedBadge /> : null}
        {item.isPinned ? <Pin className="size-3 shrink-0" aria-label={tc("pinned")} /> : null}
        {item.isFavorite ? (
          <Star className="size-3 shrink-0 fill-amber-400 text-amber-400" aria-label={tc("favorite")} />
        ) : null}
        <CommandCopyButton
          itemId={item.id}
          title={item.title}
          text={command.text}
          isCut={command.isCut}
          hasVariables={command.hasVariables}
          // Hidden until hover only with a mouse: a touch screen, even a wide one, never hovers.
          className="pointer-fine:opacity-0 pointer-fine:group-hover:opacity-100 pointer-fine:focus-visible:opacity-100"
        />
      </div>
    </li>
  );
}
