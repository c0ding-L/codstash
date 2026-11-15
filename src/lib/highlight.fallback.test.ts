import { beforeEach, describe, expect, it, vi } from "vitest";

// Shiki stood in for, so the highlighter can be made to fail. A separate file from
// highlight.test.ts, which runs the real Shiki.
const createHighlighter = vi.fn();
vi.mock("shiki", () => ({ bundledLanguages: { typescript: () => null }, createHighlighter }));

const { highlightCode } = await import("@/lib/highlight");

const working = {
  getLoadedLanguages: () => ["typescript"],
  loadLanguage: vi.fn(),
  codeToHtml: () => "<pre>highlighted</pre>",
};

beforeEach(() => {
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("highlightCode when Shiki fails", () => {
  it("shows the code as escaped plain text, one line per line, instead of failing the page", async () => {
    createHighlighter.mockRejectedValueOnce(new Error("engine failed"));

    const html = await highlightCode(`a <b> & "c"\nsecond`, "typescript");

    expect(html).toBe(
      '<pre class="shiki"><code><span class="line">a &lt;b&gt; &amp; &quot;c&quot;</span>\n<span class="line">second</span></code></pre>',
    );
  });

  it("tries to start the highlighter again after a failed start", async () => {
    createHighlighter.mockResolvedValueOnce(working);

    expect(await highlightCode("const a = 1;", "typescript")).toBe("<pre>highlighted</pre>");
  });

  it("falls back to plain text when one highlight fails", async () => {
    // The highlighter from the previous test is kept; this time its output throws.
    working.codeToHtml = () => {
      throw new Error("grammar failed");
    };

    expect(await highlightCode("x", "typescript")).toBe('<pre class="shiki"><code><span class="line">x</span></code></pre>');
  });
});
