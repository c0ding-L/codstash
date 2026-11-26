import { describe, expect, it, vi } from "vitest";

import { exportHeader, type ExportItemRow } from "@/lib/export";
import { zipEntries, type ZipEntry } from "@/lib/export-zip";

const NOW = new Date("2026-11-26T10:00:00.000Z");

const header = exportHeader({
  user: { name: null, email: "demo@example.com", locale: null },
  types: [],
  collections: [],
  exportedAt: NOW,
});

function row(id: string, overrides: Partial<ExportItemRow> = {}): ExportItemRow {
  return {
    id,
    title: id,
    description: null,
    contentType: "text",
    content: `content of ${id}`,
    url: null,
    language: null,
    isFavorite: false,
    isPinned: false,
    fileName: null,
    fileSize: null,
    fileUrl: null,
    createdAt: NOW,
    updatedAt: NOW,
    type: { slug: "note", isSystem: true },
    tags: [],
    collectionIds: [],
    ...overrides,
  };
}

const ROWS = [
  row("note00000001"),
  row("link00000001", { type: { slug: "link", isSystem: true }, url: "https://example.com", content: null }),
  row("file00000001", { contentType: "file", fileName: "a.pdf", fileUrl: "key-a", type: { slug: "file", isSystem: true } }),
  row("file00000002", { contentType: "file", fileName: "b.png", fileUrl: "key-b", type: { slug: "image", isSystem: true } }),
];

function itemPages() {
  return (async function* () {
    yield ROWS.slice(0, 2);
    yield ROWS.slice(2);
  })();
}

async function entriesOf(getObject: (key: string) => Promise<{ body: ReadableStream } | null>) {
  const entries: ZipEntry[] = [];
  for await (const entry of zipEntries({ header, itemPages, getObject, now: NOW })) entries.push(entry);
  return entries;
}

async function textOf(input: ZipEntry["input"]) {
  if (typeof input === "string") return input;
  let text = "";
  for await (const chunk of input as AsyncIterable<string>) text += chunk;
  return text;
}

describe("zipEntries", () => {
  it("writes data.json first, then items, files and links.md", async () => {
    const body = new ReadableStream();
    const getObject = vi.fn(async () => ({ body }));

    const entries = await entriesOf(getObject);

    expect(entries.map((entry) => entry.name)).toEqual([
      "data.json",
      "items/notes/note00000001-00000001.md",
      "files/00000001-a.pdf",
      "files/00000002-b.png",
      "links.md",
    ]);
    expect(JSON.parse(await textOf(entries[0]!.input)).items).toHaveLength(4);
    expect(entries[2]!.input).toBe(body);
    expect(getObject).toHaveBeenCalledWith("key-a");
    expect(await textOf(entries[4]!.input)).toContain("https://example.com");
  });

  it("skips a missing or unreadable file and lists it last", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const getObject = vi.fn(async (key: string) => {
      if (key === "key-a") return null;
      throw new Error("R2 is down");
    });

    const entries = await entriesOf(getObject);
    const names = entries.map((entry) => entry.name);

    expect(names).not.toContain("files/00000001-a.pdf");
    expect(names.at(-1)).toBe("missing-files.txt");
    const missing = await textOf(entries.at(-1)!.input);
    expect(missing).toContain("files/00000001-a.pdf");
    expect(missing).toContain("files/00000002-b.png");
  });
});
