import { describe, expect, it } from "vitest";

import { setTestLocale } from "@/lib/__fixtures__/i18n-setup";
import {
  contextDisposition,
  contextFileName,
  fenceFor,
  renderCollectionContext,
  shiftHeadings,
  type ContextItemRow,
} from "@/lib/context-export";

const NOW = new Date("2026-11-26T10:00:00.000Z");
const SYSTEM = { snippet: "Snippet", command: "Command", prompt: "Prompt", note: "Note", link: "Link", file: "File", image: "Image" };

let nextId = 0;
function item(slug: keyof typeof SYSTEM, overrides: Partial<ContextItemRow> = {}): ContextItemRow {
  nextId += 1;
  return {
    id: `item_${nextId}`,
    title: `${SYSTEM[slug]} ${nextId}`,
    description: null,
    content: null,
    url: null,
    language: null,
    fileName: null,
    fileSize: null,
    updatedAt: NOW,
    type: { slug, name: SYSTEM[slug], isSystem: true },
    ...overrides,
  };
}

function custom(name: string, overrides: Partial<ContextItemRow> = {}): ContextItemRow {
  return item("note", { type: { slug: name.toLowerCase(), name, isSystem: false }, ...overrides });
}

const collection = { name: "React", description: null };
const render = (items: ContextItemRow[], extra: Partial<Parameters<typeof renderCollectionContext>[0]> = {}) =>
  renderCollectionContext({ collection, items, exportedAt: NOW, ...extra });

/** The `## ` headings of the file, in order. */
const sections = (markdown: string) => [...markdown.matchAll(/^## (.+)$/gm)].map((match) => match[1]);

describe("fenceFor", () => {
  it("uses three backticks for plain content", () => {
    expect(fenceFor("const a = 1;")).toBe("```");
  });

  it("outgrows the longest run of backticks in the content", () => {
    expect(fenceFor("```ts\nx\n```")).toBe("````");
    expect(fenceFor("a ````` b")).toBe("``````");
  });
});

describe("shiftHeadings", () => {
  it("moves every heading down two levels", () => {
    expect(shiftHeadings("# Title\ntext\n## Part\n   ### Indented")).toBe("### Title\ntext\n#### Part\n   ##### Indented");
  });

  it("stops at six levels", () => {
    expect(shiftHeadings("##### Five\n###### Six")).toBe("###### Five\n###### Six");
  });

  it("leaves lines inside fenced code alone", () => {
    const note = "# Setup\n```bash\n# install\nnpm i\n```\n~~~\n# still code\n~~~\n# After";
    expect(shiftHeadings(note)).toBe("### Setup\n```bash\n# install\nnpm i\n```\n~~~\n# still code\n~~~\n### After");
  });

  it("closes a fence the note left open", () => {
    expect(shiftHeadings("# Setup\n````bash\nnpm i")).toBe("### Setup\n````bash\nnpm i\n````");
    expect(shiftHeadings("~~~\n# code\n")).toBe("~~~\n# code\n~~~");
  });

  it("does not treat a hash without a space as a heading", () => {
    expect(shiftHeadings("#hashtag\n#")).toBe("#hashtag\n###");
  });
});

describe("renderCollectionContext", () => {
  it("opens with the name, the description as written and a summary line", () => {
    const markdown = renderCollectionContext({
      collection: { name: "React", description: "Next 16, **strict** TS.\n\nNo `any`." },
      items: [item("snippet"), item("note")],
      exportedAt: NOW,
    });

    expect(markdown.startsWith("# React\n\nNext 16, **strict** TS.\n\nNo `any`.\n\n_Exported from Cortex on 2026-11-26. 2 items._\n")).toBe(true);
  });

  it("says 1 item, and leaves out a blank description", () => {
    const markdown = renderCollectionContext({ collection: { name: "A", description: "  " }, items: [item("link")], exportedAt: NOW });

    expect(markdown.startsWith("# A\n\n_Exported from Cortex on 2026-11-26. 1 item._\n")).toBe(true);
  });

  it("orders the sections and leaves the empty ones out", () => {
    const markdown = render([
      item("file", { fileName: "a.pdf" }),
      item("link", { url: "https://a.dev" }),
      custom("Recipe"),
      item("prompt"),
      custom("Checklist"),
      item("snippet"),
    ]);

    expect(sections(markdown)).toEqual(["Snippets", "Prompts", "Checklist", "Recipe", "Links", "Files"]);
  });

  it("gives a custom type its own section, even when its slug is a system one", () => {
    const markdown = render([item("note"), custom("Note", { title: "Mine", type: { slug: "note", name: "Ideas", isSystem: false } })]);

    expect(sections(markdown)).toEqual(["Notes", "Ideas"]);
  });

  it("sorts items in a section newest first", () => {
    const markdown = render([
      item("snippet", { title: "Old", updatedAt: new Date("2026-01-01") }),
      item("snippet", { title: "New", updatedAt: new Date("2026-06-01") }),
    ]);

    expect(markdown.indexOf("### New")).toBeLessThan(markdown.indexOf("### Old"));
  });

  it("fences snippets with their language, commands with bash by default and prompts as text", () => {
    const markdown = render([
      item("snippet", { title: "Hook", description: "A hook.", language: "tsx", content: "export {}" }),
      item("command", { title: "Install", content: "npm i\n" }),
      item("prompt", { title: "Review", content: "# Role\nYou review code." }),
    ]);

    expect(markdown).toContain("### Hook\n\nA hook.\n\n```tsx\nexport {}\n```\n");
    expect(markdown).toContain("### Install\n\n```bash\nnpm i\n```\n");
    // A prompt's Markdown stays literal: its heading is not shifted.
    expect(markdown).toContain("### Review\n\n```text\n# Role\nYou review code.\n```\n");
  });

  it("lengthens the fence when the content holds one", () => {
    const markdown = render([item("snippet", { title: "Readme", language: "md", content: "```ts\nconst a = 1;\n```" })]);

    expect(markdown).toContain("````md\n```ts\nconst a = 1;\n```\n````\n");
  });

  it("renders notes and custom types as raw Markdown with their headings shifted", () => {
    const markdown = render([
      item("note", { title: "Conventions", content: "# Naming\nUse camelCase." }),
      custom("Recipe", { title: "Deploy", content: "## Steps\n1. Push" }),
    ]);

    expect(markdown).toContain("## Notes\n\n### Conventions\n\n### Naming\nUse camelCase.\n");
    expect(markdown).toContain("## Recipe\n\n### Deploy\n\n#### Steps\n1. Push\n");
  });

  it("keeps an unclosed fence in a note from swallowing the next items", () => {
    const markdown = render([
      item("note", { title: "Draft", content: "```js\nconst a = 1;" }),
      item("link", { title: "Docs", url: "https://a.dev" }),
    ]);

    expect(markdown).toContain("### Draft\n\n```js\nconst a = 1;\n```\n\n## Links\n");
  });

  it("lists links and files on one line each", () => {
    const markdown = render([
      item("link", { title: "Docs [v2]", url: "https://a.dev/x y", description: "The  docs." }),
      item("link", { title: "Repo", url: "https://github.com/a" }),
      item("file", { title: "Spec", fileName: "spec.pdf", fileSize: 2_400_000, content: "never shown" }),
      item("image", { title: "Logo", fileName: "logo.png", fileSize: 512 }),
      item("file", { title: "Untitled upload" }),
    ]);

    expect(markdown).toContain("## Links\n\n- [Docs \\[v2\\]](<https://a.dev/x%20y>): The docs.\n- [Repo](<https://github.com/a>)\n");
    expect(markdown).toContain("## Files\n\n- spec.pdf (2.3 MB)\n- logo.png (512 B)\n- Untitled upload\n");
    expect(markdown).not.toContain("never shown");
  });

  it("writes the headings in English and leaves the user's text untouched in French", () => {
    setTestLocale("fr");
    const markdown = renderCollectionContext({
      collection: { name: "Réglages", description: "Pile : Next.js, « strict »." },
      items: [item("snippet", { title: "Crochet", content: "const à = 1;" }), item("file", { fileName: "a.pdf", fileSize: 2048 })],
      exportedAt: NOW,
    });

    expect(markdown).toContain("# Réglages\n\nPile : Next.js, « strict ».\n\n_Exported from Cortex");
    expect(sections(markdown)).toEqual(["Snippets", "Files"]);
    expect(markdown).toContain("const à = 1;");
    expect(markdown).toContain("- a.pdf (2.0 KB)");
  });

  it("stops at an item boundary past the cap and says how many were left out", () => {
    const items = Array.from({ length: 10 }, (_, index) =>
      item("snippet", { title: `S${index}`, content: "x".repeat(100), updatedAt: new Date(NOW.getTime() - index * 1000) }),
    );
    const full = render(items);
    const maxChars = Math.floor(full.length / 2);

    const markdown = render(items, { maxChars });

    expect(markdown.length).toBeLessThanOrEqual(maxChars);
    expect(markdown).toMatch(/\n_Truncated: \d+ more items not included\._\n$/);
    const shown = (markdown.match(/^### /gm) ?? []).length;
    const left = Number(/Truncated: (\d+)/.exec(markdown)![1]);
    expect(shown + left).toBe(10);
    expect(shown).toBeGreaterThan(0);
    // Every item shown is whole: its fence is closed.
    expect((markdown.match(/^```/gm) ?? []).length).toBe(shown * 2);
  });

  it("returns the whole file when it fits", () => {
    const items = [item("snippet", { content: "x" })];
    expect(render(items, { maxChars: render(items).length })).not.toContain("Truncated");
  });
});

describe("contextDisposition", () => {
  it("names the file after the collection, safe on every OS", () => {
    expect(contextFileName('React: "hooks"/patterns')).toBe("React hooks patterns-context.md");
  });

  it("keeps the header ASCII and carries the real name in filename*", () => {
    const header = contextDisposition("Réglages 🚀");

    expect(header).toMatch(/^[\x20-\x7e]+$/);
    expect(header).toContain('filename="Reglages _-context.md"');
    expect(header).toContain(`filename*=UTF-8''${encodeURIComponent("Réglages 🚀-context.md")}`);
  });
});
