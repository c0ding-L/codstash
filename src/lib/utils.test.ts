import { describe, expect, it } from "vitest";

import { isWebUrl, shortId, truncate } from "@/lib/utils";

describe("isWebUrl", () => {
  it.each(["https://example.com", "http://example.com/a?b=c", "HTTPS://EXAMPLE.COM"])("accepts %s", (url) => {
    expect(isWebUrl(url)).toBe(true);
  });

  it.each([
    "javascript:alert(1)",
    "JavaScript:alert(1)",
    " javascript:alert(1)",
    "data:text/html,<script>alert(1)</script>",
    "javascript:alert('https://example.com')",
    "//example.com",
    "ftp://example.com",
    "https:/example.com",
    "example.com",
    "",
  ])("rejects %j", (url) => {
    expect(isWebUrl(url)).toBe(false);
  });
});

describe("shortId", () => {
  it("keeps the random end of an id, not its timestamp start", () => {
    // Two cuid() v1 ids made in the same burst: same start, different end.
    expect(shortId("cmh1a2b3c0000abcdaaaaaaaa")).toBe("aaaaaaaa");
    expect(shortId("cmh1a2b3c0000abcdbbbbbbbb")).toBe("bbbbbbbb");
  });
});

describe("truncate", () => {
  it("leaves text within the limit whole", () => {
    expect(truncate("short", 5)).toBe("short");
  });

  it("keeps the ellipsis within the limit", () => {
    expect(truncate("abcdefghij", 5)).toBe("abcd…");
  });

  it("cuts at the last word or line break that fits", () => {
    expect(truncate("one two three", 10, { at: "word" })).toBe("one two…");
    expect(truncate("one\ntwo three", 9, { at: "lineOrWord" })).toBe("one\ntwo…");
    expect(truncate("onetwothree", 6, { at: "word" })).toBe("onetw…");
  });

  it("drops trailing punctuation before the ellipsis when asked", () => {
    expect(truncate("Hello, world again", 10, { at: "word", stripPunctuation: true })).toBe("Hello…");
  });
});
