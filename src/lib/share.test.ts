import { describe, expect, it } from "vitest";

import { generateShareId, isShareId, sharePath, visibleSharedItems } from "@/lib/share";

/** Made-up keys with the right shape, built from pieces as in `secrets.test.ts`. */
const run = (chars: string, length: number) => chars.repeat(Math.ceil(length / chars.length)).slice(0, length);
const RANDOM = "q7Rk2Lm9Vt4Bn8Zc";

describe("generateShareId", () => {
  it("makes 22 base64url characters", () => {
    for (let i = 0; i < 50; i++) {
      expect(generateShareId()).toMatch(/^[A-Za-z0-9_-]{22}$/);
    }
  });

  it("makes a different id each time", () => {
    const ids = new Set(Array.from({ length: 200 }, generateShareId));
    expect(ids.size).toBe(200);
  });
});

describe("isShareId", () => {
  it("accepts a generated id", () => {
    expect(isShareId(generateShareId())).toBe(true);
  });

  it("refuses anything else", () => {
    expect(isShareId("short")).toBe(false);
    expect(isShareId("a".repeat(23))).toBe(false);
    expect(isShareId("a".repeat(21) + "/")).toBe(false);
    expect(isShareId(undefined)).toBe(false);
  });
});

describe("sharePath", () => {
  it("puts items under /s/i and collections under /s", () => {
    expect(sharePath("item", "abc")).toBe("/s/i/abc");
    expect(sharePath("collection", "abc")).toBe("/s/abc");
  });
});

describe("visibleSharedItems", () => {
  it("drops the items that look like secrets, in any field", () => {
    const clean = { title: "Deploy", content: "npm run build" };
    const inContent = { title: "Keys", content: "ghp_" + run(RANDOM, 36) };
    const inUrl = { title: "Hook", url: "https://example.com/?token=sk-" + "ant-" + run(RANDOM, 40) };

    expect(visibleSharedItems([clean, inContent, inUrl])).toEqual([clean]);
  });
});
