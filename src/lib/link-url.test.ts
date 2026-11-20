import { describe, expect, it } from "vitest";

import { faviconUrl, parseLinkUrl } from "@/lib/link-url";

describe("parseLinkUrl", () => {
  it("splits a web URL into its domain and path", () => {
    expect(parseLinkUrl("https://docs.github.com/en/actions/writing-workflows")).toEqual({
      domain: "docs.github.com",
      path: "/en/actions/writing-workflows",
    });
  });

  it("drops www. from the domain", () => {
    expect(parseLinkUrl("https://www.refactoringui.com/book").domain).toBe("refactoringui.com");
  });

  it("leaves the path empty for a bare domain, with or without the slash", () => {
    expect(parseLinkUrl("https://lucide.dev")).toEqual({ domain: "lucide.dev", path: "" });
    expect(parseLinkUrl("https://lucide.dev/")).toEqual({ domain: "lucide.dev", path: "" });
  });

  it("keeps the query and the hash in the path", () => {
    expect(parseLinkUrl("https://example.com/search?q=next#results").path).toBe("/search?q=next#results");
  });

  it("keeps the port in the domain", () => {
    expect(parseLinkUrl("http://localhost:3000/items").domain).toBe("localhost:3000");
  });

  it("shows an encoded path decoded, and a malformed escape as it is", () => {
    expect(parseLinkUrl("https://example.com/caf%C3%A9%20menu").path).toBe("/café menu");
    expect(parseLinkUrl("https://example.com/100%25%zz").path).toBe("/100%25%zz");
  });

  it("returns a non-web URL whole, as the domain, with no path", () => {
    expect(parseLinkUrl("mailto:team@example.com")).toEqual({ domain: "mailto:team@example.com", path: "" });
    expect(parseLinkUrl("javascript:alert(1)")).toEqual({ domain: "javascript:alert(1)", path: "" });
  });

  it("returns a string that is not a URL whole, as the domain", () => {
    expect(parseLinkUrl("not a url")).toEqual({ domain: "not a url", path: "" });
  });
});

describe("faviconUrl", () => {
  it("asks DuckDuckGo for the hostname only, without www., port, path or query", () => {
    expect(faviconUrl("https://www.GitHub.com:8443/en/actions?tab=1#top")).toBe(
      "https://icons.duckduckgo.com/ip3/github.com.ico",
    );
  });

  it("keeps subdomains other than www.", () => {
    expect(faviconUrl("https://docs.docker.com/reference/")).toBe("https://icons.duckduckgo.com/ip3/docs.docker.com.ico");
  });

  it("is null for anything that is not a web URL", () => {
    expect(faviconUrl("mailto:team@example.com")).toBeNull();
    expect(faviconUrl("javascript:alert(1)")).toBeNull();
    expect(faviconUrl("not a url")).toBeNull();
    expect(faviconUrl("")).toBeNull();
  });
});
