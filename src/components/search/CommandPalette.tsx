"use client";

import { Folder, Search } from "lucide-react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

import { useOpenItemDrawer } from "@/components/items/ItemDrawerProvider";
import { TypeIconTile } from "@/components/items/TypeIconTile";
import {
  Command,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandShortcut,
} from "@/components/ui/command";
import type { SearchCollection } from "@/lib/db/collections";
import type { SearchItem, SearchItemJson } from "@/lib/db/items";
import { toColorToken, toItemTypeSlug } from "@/lib/item-type-ui";
import { normalizeSearchText, searchScore } from "@/lib/search-match";

/** An entry with its search text: the label first, normalised once when the data loads. */
interface Searchable<T> {
  entry: T;
  keywords: string[];
}

interface SearchData {
  items: Searchable<SearchItem>[];
  collections: Searchable<SearchCollection>[];
}

/** Everything the drawer shows about an item, so a match anywhere in it is found. */
function itemKeywords(item: SearchItem): string[] {
  const fields = [
    item.title,
    item.type.name,
    item.description,
    item.content,
    item.url,
    item.fileName,
    item.language,
    ...item.tags,
    ...item.collections.map(({ name }) => name),
  ];
  return fields.map((field) => normalizeSearchText(field ?? ""));
}

type SearchState = { status: "loading" } | { status: "error" } | { status: "ready"; data: SearchData };

/**
 * Each entry's `value` is its id, so two entries with the same title stay apart.
 * The id must not count towards a match, so only the keywords are scored: the
 * first is the label, matched loosely; the rest only match exactly. They are
 * already normalised, see `Searchable`.
 */
function filterByKeywords(_value: string, search: string, keywords: string[] = []) {
  const [label = "", ...rest] = keywords;
  return searchScore(search, label, rest);
}

/** The palette data, loaded once when the app shell mounts; `reload` fetches it again. */
function useSearchData() {
  const [state, setState] = useState<SearchState>({ status: "loading" });
  const request = useRef<AbortController | null>(null);

  const reload = useCallback(() => {
    request.current?.abort();
    const controller = new AbortController();
    request.current = controller;

    fetch("/api/search", { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const json = (await response.json()) as { items: SearchItemJson[]; collections: SearchCollection[] };
        // The drawer formats the date, so it is a `Date` again before any item can open.
        const items = json.items.map((json) => {
          const item: SearchItem = { ...json, updatedAt: new Date(json.updatedAt) };
          return { entry: item, keywords: itemKeywords(item) };
        });
        const collections = json.collections.map((collection) => ({
          entry: collection,
          keywords: [normalizeSearchText(collection.name)],
        }));
        setState({ status: "ready", data: { items, collections } });
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) return;
        console.error("[search] could not load the palette data:", error);
        // Keep the last good data: a failed refresh should not empty the palette.
        setState((current) => (current.status === "ready" ? current : { status: "error" }));
      });
  }, []);

  useEffect(() => {
    reload();
    return () => request.current?.abort();
  }, [reload]);

  return { state, reload };
}

/**
 * The top bar's search field and the command palette it opens. Cmd+K / Ctrl+K
 * toggles it from anywhere in the app. Searching happens in the browser over
 * every field of the user's most recent items, and their collections; choosing an item opens its
 * drawer, choosing a collection opens its page.
 */
export function CommandPalette() {
  const t = useTranslations("search");
  const [open, setOpen] = useState(false);
  const { state, reload } = useSearchData();
  const openItem = useOpenItemDrawer();
  const router = useRouter();

  // Refresh on every open, so an item created or edited since the last open is found.
  useEffect(() => {
    if (open) reload();
  }, [open, reload]);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key.toLowerCase() !== "k" || !(event.metaKey || event.ctrlKey)) return;
      // Ctrl+K otherwise focuses the browser's own search bar.
      event.preventDefault();
      setOpen((current) => !current);
    }

    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, []);

  function selectItem(item: SearchItem) {
    setOpen(false);
    openItem(item);
  }

  function selectCollection(collection: SearchCollection) {
    setOpen(false);
    router.push(`/collections/${encodeURIComponent(collection.id)}`);
  }

  return (
    <>
      {/* A button, not an input: the dialog returns focus here when it closes, and an input that opened on focus would reopen it. */}
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="relative flex h-9 w-full max-w-md min-w-0 items-center gap-2 rounded-lg border border-input bg-transparent pr-2 pl-2.5 text-left text-sm text-muted-foreground transition-colors outline-none hover:bg-muted/50 focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30"
      >
        <Search className="size-4 shrink-0" aria-hidden />
        <span className="flex-1 truncate">
          <span className="sm:hidden">{t("triggerShort")}</span>
          <span className="hidden sm:inline">{t("trigger")}</span>
        </span>
        <kbd className="pointer-events-none hidden rounded border border-border bg-muted px-1.5 font-mono text-[0.7rem] font-medium sm:inline-block">
          ⌘K
        </kbd>
      </button>

      <CommandDialog
        open={open}
        onOpenChange={setOpen}
        title={t("title")}
        description={t("description")}
        className="sm:max-w-xl"
      >
        <Command filter={filterByKeywords}>
          <CommandInput placeholder={t("placeholder")} />
          <CommandList className="max-h-96">
            {state.status === "ready" ? (
              <>
                <CommandEmpty>{t("empty")}</CommandEmpty>
                <PaletteResults data={state.data} onSelectItem={selectItem} onSelectCollection={selectCollection} />
              </>
            ) : (
              <p className="py-6 text-center text-sm text-muted-foreground">
                {state.status === "loading" ? t("loading") : t("loadFailed")}
              </p>
            )}
          </CommandList>
        </Command>
      </CommandDialog>
    </>
  );
}

interface PaletteResultsProps {
  data: SearchData;
  onSelectItem: (item: SearchItem) => void;
  onSelectCollection: (collection: SearchCollection) => void;
}

function PaletteResults({ data, onSelectItem, onSelectCollection }: PaletteResultsProps) {
  const t = useTranslations();

  return (
    <>
      {data.items.length > 0 ? (
        <CommandGroup heading={t("search.items")}>
          {data.items.map(({ entry: item, keywords }) => (
            <CommandItem
              key={item.id}
              value={`item-${item.id}`}
              keywords={keywords}
              onSelect={() => onSelectItem(item)}
            >
              <TypeIconTile
                slug={toItemTypeSlug(item.type.slug)}
                color={toColorToken(item.type.color)}
                className="size-7 shrink-0 rounded-md"
                iconClassName="size-4"
                mutedFallback
              />
              <span className="flex min-w-0 flex-col">
                <span className="truncate">{item.title}</span>
                {item.preview ? (
                  <span className="truncate text-xs text-muted-foreground">{item.preview}</span>
                ) : null}
              </span>
              <CommandShortcut className="tracking-normal">
                {/* System types by slug, in the UI language; a custom type keeps its own name. */}
                {(() => {
                  const slug = toItemTypeSlug(item.type.slug);
                  return slug ? t(`itemTypes.${slug}.one`) : item.type.name;
                })()}
              </CommandShortcut>
            </CommandItem>
          ))}
        </CommandGroup>
      ) : null}

      {data.collections.length > 0 ? (
        <CommandGroup heading={t("search.collections")}>
          {data.collections.map(({ entry: collection, keywords }) => (
            <CommandItem
              key={collection.id}
              value={`collection-${collection.id}`}
              keywords={keywords}
              onSelect={() => onSelectCollection(collection)}
            >
              <span className="flex size-7 shrink-0 items-center justify-center rounded-md bg-muted" aria-hidden>
                <Folder className="size-4 text-muted-foreground" />
              </span>
              <span className="truncate">{collection.name}</span>
              <CommandShortcut className="tracking-normal">
                {t("search.itemCount", { count: collection.itemCount })}
              </CommandShortcut>
            </CommandItem>
          ))}
        </CommandGroup>
      ) : null}
    </>
  );
}
