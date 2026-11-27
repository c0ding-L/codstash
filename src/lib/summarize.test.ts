import { describe, expect, it } from "vitest";

import { SUMMARY_MIN_CHARS, canSummarize, readTextStart } from "@/lib/summarize";

const LONG = "a".repeat(SUMMARY_MIN_CHARS);

/** A stream of these byte chunks, recording whether it was cancelled. */
function bytes(...chunks: (string | number[])[]) {
  const encoder = new TextEncoder();
  const queue = chunks.map((chunk) => (typeof chunk === "string" ? encoder.encode(chunk) : new Uint8Array(chunk)));
  let cancelled = false;
  const stream = new ReadableStream<Uint8Array>({
    pull(controller) {
      const next = queue.shift();
      if (next) controller.enqueue(next);
      else controller.close();
    },
    cancel() {
      cancelled = true;
    },
  });
  return { stream, wasCancelled: () => cancelled };
}

describe("canSummarize", () => {
  it.each(["note", "prompt"])("takes a %s from the threshold up", (slug) => {
    expect(canSummarize({ slug, content: LONG })).toBe(true);
    expect(canSummarize({ slug, content: LONG.slice(1) })).toBe(false);
    // Whitespace does not count towards the length.
    expect(canSummarize({ slug, content: `  ${LONG.slice(1)}\n\n` })).toBe(false);
    expect(canSummarize({ slug, content: null })).toBe(false);
  });

  it.each(["snippet", "command", "link", "image", "custom", null])("never takes a %s", (slug) => {
    expect(canSummarize({ slug, content: LONG, fileName: "a.md", fileSize: 10_000 })).toBe(false);
  });

  it.each(["notes.txt", "README.md", "data.json", "ci.yaml", "ci.yml", "pom.xml", "sales.csv", "Cargo.toml", "php.ini", "UPPER.MD"])(
    "takes a long text file: %s",
    (fileName) => {
      expect(canSummarize({ slug: "file", fileName, fileSize: SUMMARY_MIN_CHARS })).toBe(true);
    },
  );

  it("refuses a short text file, a PDF, a file with no name or size", () => {
    expect(canSummarize({ slug: "file", fileName: "a.md", fileSize: SUMMARY_MIN_CHARS - 1 })).toBe(false);
    expect(canSummarize({ slug: "file", fileName: "spec.pdf", fileSize: 1_000_000 })).toBe(false);
    expect(canSummarize({ slug: "file", fileName: "Makefile", fileSize: 10_000 })).toBe(false);
    expect(canSummarize({ slug: "file", fileName: null, fileSize: 10_000 })).toBe(false);
    expect(canSummarize({ slug: "file", fileName: "a.md", fileSize: null })).toBe(false);
  });
});

describe("readTextStart", () => {
  it("reads a whole short file", async () => {
    const { stream } = bytes("# Title\n", "café ✓");
    expect(await readTextStart(stream, 100)).toEqual({ text: "# Title\ncafé ✓", truncated: false });
  });

  it("stops at the limit, says so, and stops reading", async () => {
    const { stream, wasCancelled } = bytes("abcdef", "ghij", "never read");
    expect(await readTextStart(stream, 8)).toEqual({ text: "abcdefgh", truncated: true });
    expect(wasCancelled()).toBe(true);
  });

  it("keeps a character split across chunks", async () => {
    // "é" is 0xC3 0xA9.
    const { stream } = bytes([0x63, 0x61, 0x66, 0xc3], [0xa9]);
    expect(await readTextStart(stream, 100)).toEqual({ text: "café", truncated: false });
  });

  it("refuses invalid UTF-8, a truncated last character and NUL bytes", async () => {
    expect(await readTextStart(bytes([0x61, 0xff, 0x62]).stream, 100)).toBeNull();
    expect(await readTextStart(bytes([0x61, 0xc3]).stream, 100)).toBeNull();
    expect(await readTextStart(bytes("PK\u0000\u0003binary").stream, 100)).toBeNull();
  });
});
