import { describe, expect, it } from "vitest";

import {
  hasContentField,
  hasLanguageField,
  hasUrlField,
  initialsFromName,
  itemTypeFromPathname,
  itemTypeFromSegment,
  itemTypeHref,
  sidebarTypes,
  toColorToken,
  toItemTypeSlug,
  typePluralNames,
} from "@/lib/item-type-ui";
import type { ItemTypeSlug } from "@/types/item-type";

const SLUGS = Object.keys(typePluralNames) as ItemTypeSlug[];

describe("sidebarTypes", () => {
  it("lists every type in the design's order", () => {
    expect(sidebarTypes.map(({ slug }) => slug)).toEqual([
      "snippet",
      "prompt",
      "note",
      "command",
      "file",
      "image",
      "link",
    ]);
  });
});

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

describe("itemTypeFromPathname", () => {
  it.each(SLUGS)("reads %s from its listing page", (slug) => {
    expect(itemTypeFromPathname(itemTypeHref(slug))).toBe(slug);
  });

  it("ignores anything after the type segment", () => {
    expect(itemTypeFromPathname("/items/commands/extra")).toBe("command");
  });

  it.each(["/dashboard", "/profile", "/", "/items", "/items/", "/items/whatever", "/x/items/prompts"])(
    "returns null for %j",
    (pathname) => {
      expect(itemTypeFromPathname(pathname)).toBeNull();
    },
  );
});

describe("toItemTypeSlug", () => {
  it("accepts a system slug", () => {
    expect(toItemTypeSlug("link")).toBe("link");
  });

  // Inherited keys would otherwise pass as types, with `Object` as their icon.
  it.each(["podcast", "constructor", "toString", "__proto__"])("returns null for %s", (slug) => {
    expect(toItemTypeSlug(slug)).toBeNull();
  });
});

describe("toColorToken", () => {
  it("accepts a known token", () => {
    expect(toColorToken("lime")).toBe("lime");
  });

  // A row still on the retired `yellow` token, or with a hex value, loses its
  // accent rather than breaking the page.
  it.each(["yellow", "#ffb900", "constructor", "toString", null])("returns null for %j", (color) => {
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

describe("item form field sets", () => {
  it.each<[ItemTypeSlug, boolean, boolean, boolean]>([
    ["snippet", true, true, false],
    ["command", true, true, false],
    ["prompt", true, false, false],
    ["note", true, false, false],
    ["link", false, false, true],
    ["file", false, false, false],
    ["image", false, false, false],
  ])("%s: content %s, language %s, URL %s", (slug, content, language, url) => {
    expect(hasContentField(slug)).toBe(content);
    expect(hasLanguageField(slug)).toBe(language);
    expect(hasUrlField(slug)).toBe(url);
  });

  it("shows none of them for an unknown type", () => {
    expect(hasContentField(null)).toBe(false);
    expect(hasLanguageField(null)).toBe(false);
    expect(hasUrlField(null)).toBe(false);
  });
});
