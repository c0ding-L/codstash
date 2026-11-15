/** How many lines of a snippet the list shows. */
export const PREVIEW_LINES = 7;

/** The longest line the list receives: a minified line would otherwise travel whole. */
export const MAX_PREVIEW_LINE_CHARS = 160;

/**
 * The start of a snippet as the list shows it: its first lines, each capped, and
 * how many lines the whole snippet has (trailing blank lines not counted).
 */
export function snippetPreview(content: string): { code: string; lineCount: number } {
  const lines = content.replace(/\s+$/, "").split(/\r?\n/);
  if (lines.length === 1 && lines[0] === "") return { code: "", lineCount: 0 };

  return {
    code: lines
      .slice(0, PREVIEW_LINES)
      .map((line) => line.slice(0, MAX_PREVIEW_LINE_CHARS))
      .join("\n"),
    lineCount: lines.length,
  };
}
