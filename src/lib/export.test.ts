import { describe, expect, it } from "vitest";

import {
  EXPORT_FORMAT,
  EXPORT_VERSION,
  exportFileName,
  exportHeader,
  exportItem,
  exportJsonChunks,
  filenameFromDisposition,
  fileEntryPath,
  isExportFormat,
  itemEntryPath,
  linksMarkdown,
  renderItemText,
  safeFileName,
  type ExportItemRow,
} from "@/lib/export";

const NOW = new Date("2026-11-26T10:00:00.000Z");

function row(overrides: Partial<ExportItemRow> = {}): ExportItemRow {
  return {
    id: "cmh1a2b3c0000abcdwxyz1234",
    title: "Docker cleanup",
    description: null,
    contentType: "text",
    content: "docker system prune -af",
    url: null,
    language: "shell",
    isFavorite: false,
    isPinned: true,
    fileName: null,
    fileSize: null,
    fileUrl: null,
    createdAt: NOW,
    updatedAt: NOW,
    type: { slug: "command", isSystem: true },
    tags: ["docker"],
    collectionIds: ["col_1"],
    ...overrides,
  };
}

const header = exportHeader({
  user: { name: "Demo", email: "demo@example.com", locale: "fr" },
  types: [{ slug: "problem", name: "Problem", icon: "Bug", color: "rose" }],
  collections: [
    { id: "col_1", name: "DevOps", description: null, isFavorite: true, createdAt: NOW, updatedAt: NOW },
  ],
  exportedAt: NOW,
});

async function* pages(...list: ExportItemRow[][]) {
  for (const page of list) yield page;
}

async function collect(chunks: AsyncIterable<string>) {
  let text = "";
  for await (const chunk of chunks) text += chunk;
  return text;
}

describe("isExportFormat", () => {
  it("accepts json and zip only", () => {
    expect(isExportFormat("json")).toBe(true);
    expect(isExportFormat("zip")).toBe(true);
    expect(isExportFormat("csv")).toBe(false);
    expect(isExportFormat(null)).toBe(false);
  });
});

describe("exportHeader and exportItem", () => {
  it("stamps the format and version, with ISO dates", () => {
    expect(header).toMatchObject({
      format: EXPORT_FORMAT,
      version: EXPORT_VERSION,
      exportedAt: "2026-11-26T10:00:00.000Z",
      user: { name: "Demo", email: "demo@example.com", locale: "fr" },
      collections: [{ id: "col_1", createdAt: "2026-11-26T10:00:00.000Z" }],
    });
  });

  it("leaves the storage key out of an item", () => {
    const item = exportItem(
      row({ contentType: "file", fileName: "a.pdf", fileSize: 12, fileUrl: "users/u/secret-key", type: { slug: "file", isSystem: true } }),
    );
    expect(item.file).toEqual({ name: "a.pdf", size: 12 });
    expect(JSON.stringify(item)).not.toContain("secret-key");
    expect(item.type).toBe("file");
  });
});

describe("exportJsonChunks", () => {
  it("writes one valid document across pages", async () => {
    const text = await collect(
      exportJsonChunks(header, pages([row({ id: "a1" }), row({ id: "a2" })], [row({ id: "a3", title: 'Quote " and \\' })])),
    );
    const document = JSON.parse(text);
    expect(document.version).toBe(EXPORT_VERSION);
    expect(document.items.map((item: { id: string }) => item.id)).toEqual(["a1", "a2", "a3"]);
    expect(document.items[2].title).toBe('Quote " and \\');
    expect(document.collections).toHaveLength(1);
  });

  it("writes an empty item list for an empty stash", async () => {
    const document = JSON.parse(await collect(exportJsonChunks(header, pages())));
    expect(document.items).toEqual([]);
  });
});

describe("safeFileName", () => {
  it.each([
    ["", "untitled"],
    ["   ", "untitled"],
    ["a/b\\c:d*e?f\"g<h>i|j", "a b c d e f g h i j"],
    ["..hidden", "hidden"],
    ["ends with dots...", "ends with dots"],
    ["line\nbreak\ttab", "line break tab"],
  ])("%j → %j", (input, expected) => {
    expect(safeFileName(input)).toBe(expected);
  });

  it("caps the length but keeps the extension", () => {
    const name = safeFileName(`${"x".repeat(300)}.pdf`, 120);
    expect(name).toHaveLength(120);
    expect(name.endsWith(".pdf")).toBe(true);
  });

  it("never cuts an emoji in half", () => {
    const name = safeFileName("😀".repeat(100), 10);
    expect(Array.from(name)).toHaveLength(10);
    expect(name).toBe("😀".repeat(10));
  });
});

describe("entry paths", () => {
  it("names a command by its language, under its type's folder", () => {
    expect(itemEntryPath(row())).toBe("items/commands/Docker cleanup-wxyz1234.sh");
  });

  it("uses .sh for a command with no language and .txt for a snippet with none", () => {
    expect(itemEntryPath(row({ language: null }))).toMatch(/\.sh$/);
    expect(itemEntryPath(row({ language: null, type: { slug: "snippet", isSystem: true } }))).toMatch(/\.txt$/);
    expect(itemEntryPath(row({ language: "ts", type: { slug: "snippet", isSystem: true } }))).toMatch(/\.ts$/);
  });

  it("writes notes, prompts and custom types as Markdown", () => {
    expect(itemEntryPath(row({ type: { slug: "note", isSystem: true } }))).toMatch(/^items\/notes\/.*\.md$/);
    expect(itemEntryPath(row({ type: { slug: "problem", isSystem: false } }))).toMatch(/^items\/problems\/.*\.md$/);
  });

  it("keeps two items with the same title and the same id prefix apart", () => {
    // cuid() v1 ids made together share their first characters: only the end differs.
    const a = itemEntryPath(row({ id: "cmh1a2b3c0000abcdaaaaaaaa" }));
    const b = itemEntryPath(row({ id: "cmh1a2b3c0000abcdbbbbbbbb" }));
    expect(a).not.toBe(b);
  });

  it("puts a stored file under files/ with its own name", () => {
    expect(fileEntryPath(row({ fileName: "report final.pdf" }))).toBe("files/wxyz1234-report final.pdf");
    expect(fileEntryPath(row({ fileName: "../../etc/passwd" }))).toBe("files/wxyz1234-etc passwd");
  });
});

describe("renderItemText", () => {
  it("ends with one newline", () => {
    expect(renderItemText({ content: "a" })).toBe("a\n");
    expect(renderItemText({ content: "a\n" })).toBe("a\n");
    expect(renderItemText({ content: null })).toBe("");
  });
});

describe("linksMarkdown", () => {
  it("lists links with escaped titles and wrapped URLs", () => {
    const text = linksMarkdown([
      { title: "Docs [v2]", url: "https://example.com/a b(c)", description: "  The  docs " },
      { title: "Plain", url: "https://example.com", description: null },
    ]);
    expect(text).toBe(
      "# Links\n\n- [Docs \\[v2\\]](<https://example.com/a%20b(c)>): The docs\n- [Plain](<https://example.com>)\n",
    );
  });
});

describe("exportFileName", () => {
  it("dates the file in UTC", () => {
    expect(exportFileName("zip", NOW)).toBe("cortex-export-2026-11-26.zip");
    expect(exportFileName("json", NOW)).toBe("cortex-export-2026-11-26.json");
  });
});

describe("filenameFromDisposition", () => {
  it("reads the quoted file name", () => {
    expect(filenameFromDisposition('attachment; filename="cortex-export-2026-11-26.zip"', "x.zip")).toBe(
      "cortex-export-2026-11-26.zip",
    );
  });

  it("falls back without a header or a file name, and strips a path", () => {
    expect(filenameFromDisposition(null, "x.zip")).toBe("x.zip");
    expect(filenameFromDisposition("attachment", "x.zip")).toBe("x.zip");
    expect(filenameFromDisposition('attachment; filename="../a.zip"', "x.zip")).toBe("a.zip");
  });
});
