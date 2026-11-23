import { describe, expect, it } from "vitest";

import {
  FREE_LIMITS,
  LIMIT_MESSAGES,
  canCreateCollection,
  canCreateItem,
  canUploadFiles,
} from "@/lib/usage-limits";

const free = (items = 0, collections = 0) => ({ isPro: false, items, collections });
const pro = (items = 0, collections = 0) => ({ isPro: true, items, collections });

describe("canCreateItem", () => {
  it("lets Free create below the limit only", () => {
    expect(canCreateItem(free(49))).toBe(true);
    expect(canCreateItem(free(50))).toBe(false);
  });

  it("lets Pro create at or over the limit", () => {
    expect(canCreateItem(pro(50))).toBe(true);
    expect(canCreateItem(pro(500))).toBe(true);
  });
});

describe("canCreateCollection", () => {
  it("lets Free create below the limit only", () => {
    expect(canCreateCollection(free(0, 2))).toBe(true);
    expect(canCreateCollection(free(0, 3))).toBe(false);
  });

  it("lets Pro create at the limit", () => {
    expect(canCreateCollection(pro(0, 3))).toBe(true);
  });
});

describe("canUploadFiles", () => {
  it("is Pro-only", () => {
    expect(canUploadFiles(free())).toBe(false);
    expect(canUploadFiles(pro())).toBe(true);
  });
});

describe("LIMIT_MESSAGES", () => {
  it("names the limits from FREE_LIMITS", () => {
    expect(LIMIT_MESSAGES.items).toBe(`Free accounts can have ${FREE_LIMITS.items} items. Upgrade to Pro in Settings.`);
    expect(LIMIT_MESSAGES.items).toContain("50 items");
    expect(LIMIT_MESSAGES.collections).toContain("3 collections");
    expect(LIMIT_MESSAGES.uploads).toBe("File and image uploads are a Pro feature.");
  });
});
