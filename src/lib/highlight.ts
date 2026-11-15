// Server only: importing this from a client component would ship Shiki and its
// language list to the browser. The snippet list highlights on the server and
// sends plain coloured HTML.
import { bundledLanguages, createHighlighter, type Highlighter } from "shiki";

import { toMonacoLanguage } from "@/lib/code-language";

/** VS Code's Dark+, the closest to the editor's Monaco `vs-dark` base. */
const THEME = "dark-plus";

/** Editor ids that Shiki knows by another name. */
const SHIKI_NAMES: Record<string, string> = {
  pgsql: "sql",
  mysql: "sql",
  sol: "solidity",
};

/**
 * The Shiki language for an item's free-text `language`, through the editor's
 * aliases. Anything Shiki does not know is plain text, never an error.
 */
export function toShikiLanguage(language: string | null | undefined): string {
  const id = toMonacoLanguage(language);
  // Own entries only: `language` is free text, and `constructor` is on every object's prototype.
  const name = Object.hasOwn(SHIKI_NAMES, id) ? SHIKI_NAMES[id]! : id;
  return Object.hasOwn(bundledLanguages, name) ? name : "text";
}

// One highlighter for the server process; languages load on first use. A failed
// start is forgotten, so the next request tries again instead of failing forever.
let highlighter: Promise<Highlighter> | undefined;

function getHighlighter() {
  highlighter ??= createHighlighter({ themes: [THEME], langs: [] }).catch((error: unknown) => {
    highlighter = undefined;
    throw error;
  });
  return highlighter;
}

const HTML_ESCAPES: Record<string, string> = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };

/** The code without colours, in the same shape as Shiki's output, so the list styles it alike. */
function plainCodeHtml(code: string) {
  const lines = code
    .split("\n")
    .map((line) => `<span class="line">${line.replace(/[&<>"']/g, (c) => HTML_ESCAPES[c]!)}</span>`);
  return `<pre class="shiki"><code>${lines.join("\n")}</code></pre>`;
}

/**
 * The code as highlighted HTML: a `<pre>` with one `.line` span per line. Shiki
 * escapes the code. The block's own background and tab stop are removed, since
 * the list sets the background and the row is what takes focus. When Shiki fails,
 * the code comes back escaped and uncoloured: one snippet must not fail the page.
 */
export async function highlightCode(code: string, language: string | null | undefined): Promise<string> {
  try {
    return await highlightWithShiki(code, language);
  } catch (error) {
    console.error("Highlighting failed; showing the code as plain text.", error);
    return plainCodeHtml(code);
  }
}

async function highlightWithShiki(code: string, language: string | null | undefined) {
  const shiki = await getHighlighter();
  const lang = toShikiLanguage(language);
  if (lang !== "text" && !shiki.getLoadedLanguages().includes(lang)) {
    await shiki.loadLanguage(lang as keyof typeof bundledLanguages);
  }

  return shiki.codeToHtml(code, {
    lang,
    theme: THEME,
    transformers: [
      {
        pre(node) {
          delete node.properties.style;
          delete node.properties.tabindex;
        },
      },
    ],
  });
}
