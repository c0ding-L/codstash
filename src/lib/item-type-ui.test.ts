import { describe, expect, it } from "vitest";

import {
  initialsFromName,
  itemTypeFromSegment,
  itemTypeHref,
  toColorToken,
  toItemTypeSlug,
  typePluralNames,
} from "@/lib/item-type-ui";
import type { ItemTypeSlug } from "@/types/item-type";

const SLUGS = Object.keys(typePluralNames) as ItemTypeSlug[];

describe("itemTypeFromSegment", () => {
  it.each(SLUGS)("round-trips %s through its href", (slug) => {
    const segment = itemTypeHref(slug).replace("/items/", "");
    expect(itemTypeFromSegment(segment)).toBe(slug);
  });

  // Each of these has to reach the page's 404.
  it.each(["whatever", "snippet", "Snippets", "", "constructor", "__proto__"])(
    "returns null for %j",
    (segment) => {
      expect(itemTypeFromSegment(segment)).toBeNull();
    },
  );
});

describe("toItemTypeSlug", () => {
  it("accepts a system slug", () => {
    expect(toItemTypeSlug("link")).toBe("link");
  });

  it("returns null for a custom slug", () => {
    expect(toItemTypeSlug("podcast")).toBeNull();
  });
});

describe("toColorToken", () => {
  it("accepts a known token", () => {
    expect(toColorToken("lime")).toBe("lime");
  });

  // A row still on the retired `yellow` token, or with a hex value, loses its
  // accent rather than breaking the page.
  it.each(["yellow", "#ffb900", null])("returns null for %j", (color) => {
    expect(toColorToken(color)).toBeNull();
  });
});

describe("initialsFromName", () => {
  it.each([
    [null, "?"],
    ["", "?"],
    ["Demo User", "DU"],
    ["ada", "AD"],
    ["  Grace   Brewster Hopper ", "GB"],
  ])("derives initials from %j", (name, initials) => {
    expect(initialsFromName(name)).toBe(initials);
  });
});
