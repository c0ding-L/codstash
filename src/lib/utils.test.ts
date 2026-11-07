import { describe, expect, it } from "vitest";

import { isWebUrl } from "@/lib/utils";

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
