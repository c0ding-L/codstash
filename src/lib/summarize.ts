// Which items get an AI summary, and how a stored file's text is read for one. Pure, except
// `readTextStart`, which reads a stream.

import { extensionOf } from "@/lib/files";

/** Below this length the description says enough: no Summarize button. Characters, or bytes for a file. */
export const SUMMARY_MIN_CHARS = 1_500;

/** File extensions read as text for a summary. PDFs and images are not summarized. */
export const SUMMARY_TEXT_EXTENSIONS: ReadonlySet<string> = new Set([
  "txt",
  "md",
  "json",
  "yaml",
  "yml",
  "xml",
  "csv",
  "toml",
  "ini",
]);

export interface SummarizableItem {
  /** The item type's slug; a custom type's never qualifies. */
  slug: string | null | undefined;
  content?: string | null;
  fileName?: string | null;
  /** In bytes, as stored on upload. */
  fileSize?: number | null;
}

/** Whether the item gets the Summarize action: a long note or prompt, or a long text file. */
export function canSummarize({ slug, content, fileName, fileSize }: SummarizableItem): boolean {
  if (slug === "note" || slug === "prompt") return (content?.trim().length ?? 0) >= SUMMARY_MIN_CHARS;
  if (slug === "file") {
    return !!fileName && SUMMARY_TEXT_EXTENSIONS.has(extensionOf(fileName)) && (fileSize ?? 0) >= SUMMARY_MIN_CHARS;
  }
  return false;
}

/**
 * The start of a stored text file: at most `maxChars` characters, and whether there was more. The
 * rest of the stream is not read. Null when the bytes are not UTF-8 text (invalid UTF-8, or a NUL
 * byte, which no text file holds).
 */
export async function readTextStart(
  body: ReadableStream<Uint8Array>,
  maxChars: number,
): Promise<{ text: string; truncated: boolean } | null> {
  const reader = body.getReader();
  // `fatal`: invalid bytes throw instead of becoming U+FFFD. `stream: true` keeps a character split
  // across chunks for the next one, so cutting the read early never counts as invalid.
  const decoder = new TextDecoder("utf-8", { fatal: true });
  let text = "";
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) {
        text += decoder.decode();
        break;
      }
      text += decoder.decode(value, { stream: true });
      if (text.includes("\u0000")) return null;
      if (text.length > maxChars) return { text: text.slice(0, maxChars), truncated: true };
    }
  } catch {
    return null;
  } finally {
    void reader.cancel().catch(() => {});
  }
  if (text.includes("\u0000")) return null;
  return { text, truncated: false };
}
