import { beforeEach, describe, expect, it, vi, type Mock } from "vitest";

import { readCaller, USER_ID, writeCaller } from "@/lib/__fixtures__/api-v1";
import type { ApiCaller } from "@/lib/api-auth";
import type { ContextItemRow } from "@/lib/context-export";
import { getApiItem, listApiCollections, listApiItems, type ApiItem } from "@/lib/db/api-items";
import { ownsCollections } from "@/lib/db/collections";
import { getCollectionContextData } from "@/lib/db/context-export";
import { createItem } from "@/lib/db/items";
import {
  createItemTool,
  getCollectionContext,
  getItem,
  listCollections,
  MCP_CONTEXT_MAX_CHARS,
  searchItems,
} from "@/lib/mcp-tools";
import { checkRateLimit } from "@/lib/rate-limit";

vi.mock("@/lib/prisma", () => ({ prisma: {} }));
vi.mock("@/lib/db/api-items", () => ({
  listApiItems: vi.fn(),
  getApiItem: vi.fn(),
  listApiCollections: vi.fn(),
  findCustomTypeIdBySlug: vi.fn(),
}));
vi.mock("@/lib/db/context-export", () => ({ getCollectionContextData: vi.fn() }));
vi.mock("@/lib/db/collections", () => ({ ownsCollections: vi.fn() }));
vi.mock("@/lib/db/item-types", () => ({ ownsCustomType: vi.fn() }));
vi.mock("@/lib/db/items", () => ({ createItem: vi.fn() }));
vi.mock("@/lib/rate-limit", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/rate-limit")>()),
  checkRateLimit: vi.fn(),
}));

const asMock = (fn: unknown) => fn as Mock;
const textOf = (result: { content: { text: string }[] }) => result.content[0]!.text;

// Built at runtime so no secret-shaped literal sits in the source.
const GITHUB_TOKEN = `ghp_${"aB3dE6gH9jK2mN5pQ8sT1vW4yZ7bC0eF3hJ6"}`;

const SNIPPET_TYPE = { id: "t_snippet", slug: "snippet", name: "Snippet", isSystem: true };

function apiItem(overrides: Partial<ApiItem> = {}): ApiItem {
  return {
    id: "cm0item0000000000abcdefgh",
    title: "useDebounce hook",
    description: null,
    type: SNIPPET_TYPE,
    content: "export function useDebounce() {}",
    url: null,
    language: "typescript",
    file: null,
    tags: ["hooks", "react"],
    collections: [],
    isFavorite: false,
    isPinned: false,
    createdAt: new Date("2026-11-01T00:00:00Z"),
    updatedAt: new Date("2026-11-02T00:00:00Z"),
    ...overrides,
  };
}

function contextItem(overrides: Partial<ContextItemRow> = {}): ContextItemRow {
  return {
    id: "cm0ctx",
    title: "Note",
    description: null,
    content: "Hello",
    url: null,
    language: null,
    fileName: null,
    fileSize: null,
    updatedAt: new Date("2026-11-02T00:00:00Z"),
    type: { slug: "note", name: "Note", isSystem: true },
    ...overrides,
  };
}

beforeEach(() => {
  asMock(checkRateLimit).mockResolvedValue({ success: true, remaining: 10, reset: Date.now() });
  asMock(ownsCollections).mockResolvedValue(true);
  asMock(createItem).mockResolvedValue({ id: "cm0new0000000000newitem1" });
});

describe("search_items", () => {
  it("lists `id · type · title · tags` with a 200-character one-line preview, for the caller only", async () => {
    const long = `line one\n${"x".repeat(300)}`;
    asMock(listApiItems).mockResolvedValue({ items: [apiItem({ content: long })], nextCursor: null });

    const result = await searchItems(readCaller, { query: "debounce", type: "snippet", tag: "react" });

    expect(listApiItems).toHaveBeenCalledWith(USER_ID, { q: "debounce", type: "snippet", tag: "react", limit: 10 });
    expect(result.isError).toBeUndefined();
    const [header, , first, preview] = textOf(result).split("\n");
    expect(header).toBe("1 item from the user's Cortex:");
    expect(first).toBe("cm0item0000000000abcdefgh · snippet · useDebounce hook · hooks, react");
    expect(preview).toBe(`  line one ${"x".repeat(191)}…`);
  });

  it("caps the limit at 20 and says when nothing matches", async () => {
    asMock(listApiItems).mockResolvedValue({ items: [], nextCursor: null });
    const result = await searchItems(readCaller, { query: "nothing", limit: 500 });

    expect(asMock(listApiItems).mock.calls[0]![1].limit).toBe(20);
    expect(textOf(result)).toBe('No items match "nothing".');
  });
});

describe("get_item", () => {
  it("renders the fields, then the content fenced with its language", async () => {
    asMock(getApiItem).mockResolvedValue(apiItem({ description: "Delays a value." }));

    const result = await getItem(readCaller, { id: "cm0item0000000000abcdefgh" });

    expect(getApiItem).toHaveBeenCalledWith(USER_ID, "cm0item0000000000abcdefgh");
    expect(textOf(result)).toBe(
      [
        "# useDebounce hook",
        "",
        "Type: snippet",
        "Language: typescript",
        "Tags: hooks, react",
        "",
        "Delays a value.",
        "",
        "```typescript",
        "export function useDebounce() {}",
        "```",
        "",
      ].join("\n"),
    );
  });

  it("uses a longer fence when the content holds backticks", async () => {
    asMock(getApiItem).mockResolvedValue(apiItem({ content: "```js\nx\n```", language: null, type: { ...SNIPPET_TYPE, slug: "note", name: "Note" } }));
    expect(textOf(await getItem(readCaller, { id: "x" }))).toContain("````markdown\n```js\nx\n```\n````");
  });

  it("answers a tool error for another user's or a missing item", async () => {
    asMock(getApiItem).mockResolvedValue(null);
    const result = await getItem(readCaller, { id: "someone-elses" });

    expect(result.isError).toBe(true);
    expect(textOf(result)).toContain('No item with id "someone-elses"');
  });

  it("adds the secret warning when the item holds one", async () => {
    asMock(getApiItem).mockResolvedValue(apiItem({ content: `const token = "${GITHUB_TOKEN}";` }));
    const text = textOf(await getItem(readCaller, { id: "x" }));

    expect(text.split("\n")[0]).toBe("⚠ Possible secret detected (github). Review it in Cortex.");
  });
});

describe("list_collections", () => {
  it("lists `id · name · count · first description line`", async () => {
    asMock(listApiCollections).mockResolvedValue([
      { id: "c1", name: "React", description: "\nHooks and patterns\nmore", itemCount: 3 },
      { id: "c2", name: "Empty", description: null, itemCount: 1 },
    ]);

    expect(textOf(await listCollections(readCaller))).toBe("c1 · React · 3 items · Hooks and patterns\nc2 · Empty · 1 item");
    expect(listApiCollections).toHaveBeenCalledWith(USER_ID);
  });
});

describe("get_collection_context", () => {
  it("renders the collection for the caller only, capped at 100,000 characters", async () => {
    const big = "y".repeat(30_000);
    const items = Array.from({ length: 5 }, (_, index) => contextItem({ id: `n${index}`, title: `Note ${index}`, content: big }));
    asMock(getCollectionContextData).mockResolvedValue({ collection: { name: "Big", description: null }, items });

    const text = textOf(await getCollectionContext(readCaller, { id: "c1" }));

    expect(getCollectionContextData).toHaveBeenCalledWith(USER_ID, "c1");
    expect(text.length).toBeLessThanOrEqual(MCP_CONTEXT_MAX_CHARS);
    expect(text).toMatch(/^# Big\n/);
    expect(text).toContain("_Truncated: 2 more items not included._");
  });

  it("adds the secret warning and answers a tool error for an unknown collection", async () => {
    asMock(getCollectionContextData).mockResolvedValue({
      collection: { name: "Env", description: null },
      items: [contextItem({ content: `GITHUB_TOKEN=${GITHUB_TOKEN}` })],
    });
    expect(textOf(await getCollectionContext(readCaller, { id: "c1" }))).toMatch(/^⚠ Possible secret detected \(/);

    // The warning counts toward the cap.
    const big = contextItem({ id: "big", title: "Big", content: "y".repeat(MCP_CONTEXT_MAX_CHARS) });
    asMock(getCollectionContextData).mockResolvedValue({
      collection: { name: "Env", description: null },
      items: [contextItem({ content: `GITHUB_TOKEN=${GITHUB_TOKEN}` }), big],
    });
    expect(textOf(await getCollectionContext(readCaller, { id: "c1" })).length).toBeLessThanOrEqual(MCP_CONTEXT_MAX_CHARS);

    asMock(getCollectionContextData).mockResolvedValue(null);
    const missing = await getCollectionContext(readCaller, { id: "nope" });
    expect(missing.isError).toBe(true);
  });
});

describe("create_item", () => {
  const note = { type: "note", title: "Deploy steps", content: "1. build" };

  it("creates the item for the caller and answers `Created <id>: <title>`", async () => {
    const result = await createItemTool(writeCaller, { ...note, tags: ["ops"], collectionId: "c1" });

    expect(ownsCollections).toHaveBeenCalledWith(USER_ID, ["c1"]);
    expect(createItem).toHaveBeenCalledWith(
      USER_ID,
      expect.objectContaining({ type: "note", title: "Deploy steps", content: "1. build", tags: ["ops"], collectionIds: ["c1"] }),
    );
    expect(checkRateLimit).toHaveBeenCalledWith("apiWrite", "tok_1");
    expect(result).toEqual({ content: [{ type: "text", text: "Created cm0new0000000000newitem1: Deploy steps" }] });
  });

  it("refuses a read token and a lapsed Pro with a tool error, before writing", async () => {
    const readOnly = await createItemTool(readCaller, note);
    expect(readOnly.isError).toBe(true);
    expect(textOf(readOnly)).toContain("read-only");

    const free: ApiCaller = { ...writeCaller, isPro: false };
    const notPro = await createItemTool(free, note);
    expect(notPro.isError).toBe(true);
    expect(textOf(notPro)).toContain("requires CodStash Pro");

    expect(createItem).not.toHaveBeenCalled();
  });

  it("refuses past the write rate limit", async () => {
    asMock(checkRateLimit).mockResolvedValue({ success: false, remaining: 0, reset: Date.now() + 30_000 });
    const result = await createItemTool(writeCaller, note);

    expect(result.isError).toBe(true);
    expect(textOf(result)).toMatch(/Too many writes/);
    expect(createItem).not.toHaveBeenCalled();
  });

  it("explains a refused field in English, never as a translation key", async () => {
    const result = await createItemTool(writeCaller, { type: "link", title: "Docs" });

    expect(result.isError).toBe(true);
    expect(textOf(result)).toMatch(/^The item was not created\.\nurl: /);
    expect(textOf(result)).not.toMatch(/items\.urlRequired/);
  });

  it("refuses another user's collection", async () => {
    asMock(ownsCollections).mockResolvedValue(false);
    const result = await createItemTool(writeCaller, { ...note, collectionId: "theirs" });

    expect(textOf(result)).toBe("The item was not created.\ncollectionId: One of these collections does not exist.");
    expect(createItem).not.toHaveBeenCalled();
  });

  it("still creates an item holding a secret, and adds the warning", async () => {
    const result = await createItemTool(writeCaller, { ...note, content: `export GITHUB_TOKEN="${GITHUB_TOKEN}"` });

    expect(createItem).toHaveBeenCalled();
    expect(textOf(result)).toBe(
      "Created cm0new0000000000newitem1: Deploy steps\n⚠ Possible secret detected (github). Review it in Cortex.",
    );
  });
});
