import { describe, expect, it } from "vitest";

import {
  IMPORT_BATCH_MAX_ITEMS,
  ImportFormatError,
  MAX_INVALID_TITLES,
  checkCandidate,
  detectFileType,
  emptyImportResult,
  fromCortexExport,
  fromGist,
  fromLooseFile,
  importBatchSchema,
  jsonBytes,
  mergeImportResults,
  toImportBatches,
  type ImportCandidate,
} from "@/lib/import";
import { ITEM_LIMITS } from "@/lib/item-limits";

function exportDoc(overrides: Record<string, unknown> = {}) {
  return {
    format: "cortex-export",
    version: 1,
    exportedAt: "2026-11-26T10:00:00.000Z",
    user: { name: "Demo", email: "demo@example.com", locale: "en" },
    types: [{ slug: "recipe", name: "Recipe", icon: "book", color: "orange", template: null }],
    collections: [
      { id: "c1", name: "React", description: "Hooks and patterns", isFavorite: false },
      { id: "c2", name: "Ops", description: null, isFavorite: true },
    ],
    items: [],
    ...overrides,
  };
}

function exportItem(overrides: Record<string, unknown> = {}) {
  return {
    id: "i1",
    title: "Item",
    description: null,
    type: "note",
    contentType: "text",
    content: "Body",
    url: null,
    language: null,
    isFavorite: false,
    isPinned: false,
    tags: [],
    collectionIds: [],
    file: null,
    createdAt: "2026-11-26T10:00:00.000Z",
    updatedAt: "2026-11-26T10:00:00.000Z",
    ...overrides,
  };
}

function candidate(overrides: Partial<ImportCandidate> = {}): ImportCandidate {
  return { title: "Note", type: "note", content: "Body", tags: [], collectionNames: [], ...overrides };
}

describe("fromCortexExport", () => {
  it("refuses a document of another format or version", () => {
    expect(() => fromCortexExport({ ...exportDoc(), format: "other-export" })).toThrow(ImportFormatError);
    expect(() => fromCortexExport({ ...exportDoc(), version: 2 })).toThrow(ImportFormatError);
    expect(() => fromCortexExport(null)).toThrow(ImportFormatError);
    expect(() => fromCortexExport({ format: "cortex-export", version: 1 })).toThrow(ImportFormatError);
  });

  it("maps each system type with its fields, tags, collections, favorite and pin", () => {
    const parsed = fromCortexExport(
      exportDoc({
        items: [
          exportItem({ title: "Hook", type: "snippet", content: "useX()", language: "typescript", tags: ["react"], collectionIds: ["c1"] }),
          exportItem({ title: "Deploy", type: "command", content: "vercel --prod", language: "shell", isPinned: true }),
          exportItem({ title: "Review", type: "prompt", content: "Review this", language: "ignored" }),
          exportItem({ title: "Docs", type: "link", content: null, url: "https://nextjs.org", isFavorite: true, collectionIds: ["c1", "c2"] }),
          exportItem({ title: "Notes", type: "note", content: "# Hi", description: "Mine" }),
        ],
      }),
    );

    expect(parsed.result.skipped).toEqual({ duplicate: 0, file: 0, tooLong: 0, invalid: 0, limit: 0 });
    expect(parsed.candidates).toEqual([
      { title: "Hook", type: "snippet", content: "useX()", language: "typescript", description: null, tags: ["react"], collectionNames: ["React"], isFavorite: false, isPinned: false },
      { title: "Deploy", type: "command", content: "vercel --prod", language: "shell", description: null, tags: [], collectionNames: [], isFavorite: false, isPinned: true },
      { title: "Review", type: "prompt", content: "Review this", description: null, tags: [], collectionNames: [], isFavorite: false, isPinned: false },
      { title: "Docs", type: "link", url: "https://nextjs.org", description: null, tags: [], collectionNames: ["React", "Ops"], isFavorite: true, isPinned: false },
      { title: "Notes", type: "note", content: "# Hi", description: "Mine", tags: [], collectionNames: [], isFavorite: false, isPinned: false },
    ]);
    expect(parsed.collections).toEqual([
      { name: "React", description: "Hooks and patterns" },
      { name: "Ops", description: null },
    ]);
  });

  it("skips file and image items, whose bytes are not in the JSON", () => {
    const parsed = fromCortexExport(
      exportDoc({
        items: [
          exportItem({ type: "file", contentType: "file", content: null, file: { name: "a.pdf", size: 10 } }),
          exportItem({ type: "image", contentType: "file", content: null, file: { name: "a.png", size: 10 } }),
          exportItem({ title: "Kept" }),
        ],
      }),
    );

    expect(parsed.result.skipped.file).toBe(2);
    expect(parsed.candidates.map((c) => c.title)).toEqual(["Kept"]);
  });

  it("keeps a custom type by its slug and passes the export's definitions along", () => {
    const parsed = fromCortexExport(exportDoc({ items: [exportItem({ title: "Pancakes", type: "recipe", language: "markdown" })] }));

    expect(parsed.candidates[0]).toMatchObject({ title: "Pancakes", type: { customSlug: "recipe" }, language: "markdown" });
    expect(parsed.types).toEqual([{ slug: "recipe", name: "Recipe", icon: "book", color: "orange", template: null }]);
  });

  it("skips too-long content as tooLong and a javascript: link as invalid, with its title", () => {
    const parsed = fromCortexExport(
      exportDoc({
        items: [
          exportItem({ title: "Huge", content: "x".repeat(ITEM_LIMITS.content + 1) }),
          exportItem({ title: "Evil", type: "link", content: null, url: "javascript:alert(1)" }),
          exportItem({ title: "Fine" }),
        ],
      }),
    );

    expect(parsed.result.skipped.tooLong).toBe(1);
    expect(parsed.result.skipped.invalid).toBe(1);
    expect(parsed.result.invalidTitles).toEqual(["Evil"]);
    expect(parsed.candidates.map((c) => c.title)).toEqual(["Fine"]);
  });
});

describe("checkCandidate", () => {
  it("normalises a valid candidate: trimmed title, blanks as null, unused fields dropped", () => {
    expect(checkCandidate({ title: "  Hi  ", type: "note", content: "Body", language: "ts", url: "https://x.y", description: "  ", tags: ["a", "a"], collectionNames: [] })).toEqual({
      ok: true,
      candidate: { title: "Hi", type: "note", content: "Body", description: null, tags: ["a"], collectionNames: [] },
    });
  });

  it("refuses a candidate the item form would refuse", () => {
    const refused = [
      { title: "", type: "note" },
      { title: "x".repeat(ITEM_LIMITS.title + 1), type: "note" },
      { title: "Link", type: "link", url: "data:text/html,<script>" },
      { title: "Link", type: "link" },
      { title: "Tags", type: "note", tags: Array.from({ length: ITEM_LIMITS.tags + 1 }, (_, i) => `t${i}`) },
      { title: "Tag", type: "note", tags: ["x".repeat(ITEM_LIMITS.tag + 1)] },
      { title: "File", type: "file" },
      { title: "Bad type", type: "custom" },
      { title: "Collection", type: "note", collectionNames: ["x".repeat(101)] },
      "not an object",
    ];
    for (const raw of refused) expect(checkCandidate(raw)).toMatchObject({ ok: false, reason: "invalid" });
  });

  it("validates a custom-type candidate with a custom item's fields", () => {
    expect(checkCandidate({ title: "Dish", type: { customSlug: "recipe" }, content: "Eggs", language: "markdown", tags: [] })).toMatchObject({
      ok: true,
      candidate: { type: { customSlug: "recipe" }, content: "Eggs", language: "markdown" },
    });
  });

  it("merges collection names that differ only by case", () => {
    const checked = checkCandidate({ title: "A", type: "note", collectionNames: ["React", " react ", "Ops"] });
    expect(checked).toMatchObject({ ok: true, candidate: { collectionNames: ["React", "Ops"] } });
  });
});

describe("detectFileType and fromLooseFile", () => {
  it("detects the type from the extension", () => {
    expect(detectFileType("README.md")).toEqual({ type: "note", language: null });
    expect(detectFileType("notes.TXT")).toEqual({ type: "note", language: null });
    expect(detectFileType("hook.tsx")).toEqual({ type: "snippet", language: "typescript" });
    expect(detectFileType("main.py")).toEqual({ type: "snippet", language: "python" });
    expect(detectFileType("deploy.sh")).toEqual({ type: "command", language: "shell" });
    expect(detectFileType("setup.ps1")).toEqual({ type: "command", language: "powershell" });
    expect(detectFileType("build.bat")).toEqual({ type: "command", language: null });
    expect(detectFileType("photo.png")).toBeNull();
    expect(detectFileType("Makefile")).toBeNull();
  });

  it("titles the item with the file name without its extension", () => {
    expect(fromLooseFile("src/utils/debounce.ts", "export {}")).toEqual({
      ok: true,
      candidate: { title: "debounce", type: "snippet", content: "export {}", language: "typescript", description: null, tags: [], collectionNames: [] },
    });
  });

  it("takes a type chosen in the preview, dropping the language for a note", () => {
    expect(fromLooseFile("query.sql", "SELECT 1", "note")).toMatchObject({ ok: true, candidate: { type: "note" } });
    expect(fromLooseFile("query.sql", "SELECT 1", "note")).not.toHaveProperty("candidate.language");
  });

  it("is null for a type it does not take and tooLong past the content cap", () => {
    expect(fromLooseFile("a.exe", "MZ")).toBeNull();
    expect(fromLooseFile("big.md", "x".repeat(ITEM_LIMITS.content + 1))).toMatchObject({ ok: false, reason: "tooLong", title: "big" });
  });
});

describe("fromGist", () => {
  it("gives one candidate per file, tagged gist, described by the gist", () => {
    const checks = fromGist({
      id: "abc",
      description: "Handy bits",
      files: {
        "debounce.ts": { filename: "debounce.ts", language: "TypeScript", content: "export {}" },
        "README.md": { filename: "README.md", language: "Markdown", content: "# Read me" },
        "run.sh": { filename: "run.sh", language: "Shell", content: "echo hi" },
        "weird.xyz": { filename: "weird.xyz", language: "Brainfuck", content: "+++" },
      },
    });

    expect(checks.map((c) => (c.ok ? c.candidate : null))).toEqual([
      { title: "debounce", type: "snippet", content: "export {}", language: "typescript", description: "Handy bits", tags: ["gist"], collectionNames: [] },
      { title: "README", type: "note", content: "# Read me", description: "Handy bits", tags: ["gist"], collectionNames: [] },
      { title: "run", type: "snippet", content: "echo hi", language: "shell", description: "Handy bits", tags: ["gist"], collectionNames: [] },
      { title: "weird", type: "snippet", content: "+++", language: null, description: "Handy bits", tags: ["gist"], collectionNames: [] },
    ]);
  });

  it("marks a file over the content cap as tooLong", () => {
    const [check] = fromGist({
      id: "abc",
      description: null,
      files: { "big.txt": { filename: "big.txt", language: "Text", content: "x".repeat(ITEM_LIMITS.content + 1) } },
    });
    expect(check).toMatchObject({ ok: false, reason: "tooLong" });
  });
});

describe("toImportBatches", () => {
  it("caps a batch at the item count", () => {
    const candidates = Array.from({ length: IMPORT_BATCH_MAX_ITEMS * 2 + 1 }, (_, i) => candidate({ title: `N${i}` }));
    const batches = toImportBatches({ candidates, types: [], collections: [] }, "skip");
    expect(batches.map((b) => b.candidates.length)).toEqual([100, 100, 1]);
    expect(batches.every((b) => b.conflict === "skip")).toBe(true);
  });

  it("splits by UTF-8 bytes and keeps every batch under the cap", () => {
    // Three-byte characters: `.length` would undercount them threefold.
    const candidates = Array.from({ length: 10 }, (_, i) => candidate({ title: `N${i}`, content: "€".repeat(30_000) }));
    const maxBytes = 300_000;
    const batches = toImportBatches({ candidates, types: [], collections: [] }, "duplicate", { maxItems: 100, maxBytes });
    expect(batches.length).toBeGreaterThan(3);
    for (const batch of batches) expect(jsonBytes(batch)).toBeLessThanOrEqual(maxBytes);
    expect(batches.flatMap((b) => b.candidates)).toHaveLength(10);
  });

  it("sends only the type and collection definitions a batch's candidates name", () => {
    const types = [
      { slug: "recipe", name: "Recipe", icon: "book", color: "orange", template: null },
      { slug: "bug", name: "Bug", icon: "bug", color: "slate", template: null },
    ];
    const collections = [
      { name: "React", description: "d" },
      { name: "Ops", description: null },
    ];
    const [batch] = toImportBatches(
      { candidates: [candidate({ type: { customSlug: "recipe" }, collectionNames: ["react"] })], types, collections },
      "skip",
    );
    expect(batch!.types.map((t) => t.slug)).toEqual(["recipe"]);
    expect(batch!.collections.map((c) => c.name)).toEqual(["React"]);
  });
});

describe("importBatchSchema", () => {
  it("caps the candidates per batch and needs a conflict choice", () => {
    expect(importBatchSchema.safeParse({ candidates: [{}], conflict: "skip" }).success).toBe(true);
    expect(importBatchSchema.safeParse({ candidates: [], conflict: "skip" }).success).toBe(false);
    expect(importBatchSchema.safeParse({ candidates: Array(101).fill({}), conflict: "skip" }).success).toBe(false);
    expect(importBatchSchema.safeParse({ candidates: [{}], conflict: "overwrite" }).success).toBe(false);
  });
});

describe("mergeImportResults", () => {
  it("sums the counts and keeps at most the first invalid titles", () => {
    const a = { ...emptyImportResult(), created: 2, invalidTitles: Array(15).fill("a") };
    a.skipped.duplicate = 1;
    const b = { ...emptyImportResult(), created: 3, collectionsCreated: 1, collectionLinksDropped: 2, invalidTitles: Array(15).fill("b") };
    b.skipped.limit = 4;

    const merged = mergeImportResults(a, b);
    expect(merged).toMatchObject({ created: 5, collectionsCreated: 1, collectionLinksDropped: 2 });
    expect(merged.skipped).toEqual({ duplicate: 1, file: 0, tooLong: 0, invalid: 0, limit: 4 });
    expect(merged.invalidTitles).toHaveLength(MAX_INVALID_TITLES);
  });
});
