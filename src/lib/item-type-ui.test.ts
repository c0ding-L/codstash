import { describe, expect, it } from "vitest";

import { Box, Bug, Code2 } from "lucide-react";

import {
  fieldsSlugOf,
  isReservedTypeSlug,
  resolveTypeView,
  slugify,
  typeSegmentFromPathname,
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


describe("resolveTypeView", () => {
  const translate = (slug: ItemTypeSlug) => `t:${slug}`;

  it("gives a system type its own icon, translated label and plural URL", () => {
    const view = resolveTypeView({ slug: "snippet", name: "Snippet", icon: null, color: "emerald", isSystem: true }, translate);

    expect(view).toEqual({
      slug: "snippet",
      systemSlug: "snippet",
      label: "t:snippet",
      Icon: Code2,
      color: "emerald",
      href: "/items/snippets",
      isSystem: true,
    });
  });

  it("shows a custom type's name as typed, with its icon and its slug's URL", () => {
    const view = resolveTypeView({ slug: "probleme", name: "Problème", icon: "bug", color: "rose", isSystem: false }, translate);

    expect(view).toEqual({
      slug: "probleme",
      systemSlug: null,
      label: "Problème",
      Icon: Bug,
      color: "rose",
      href: "/items/probleme",
      isSystem: false,
    });
  });

  it("falls back to Box and indigo for an unknown icon or colour", () => {
    const view = resolveTypeView({ slug: "x-y", name: "X Y", icon: "rocket-ship", color: "pink", isSystem: false }, translate);

    expect(view.Icon).toBe(Box);
    expect(view.color).toBe("indigo");
  });

  it("never treats a custom row as a system type, whatever its slug", () => {
    const view = resolveTypeView({ slug: "note", name: "My notes", icon: null, color: null, isSystem: false }, translate);

    expect(view).toMatchObject({ systemSlug: null, label: "My notes", Icon: Box, href: "/items/note" });
  });

  it("gives a custom type a note's fields", () => {
    expect(fieldsSlugOf({ systemSlug: null })).toBe("note");
    expect(fieldsSlugOf({ systemSlug: "command" })).toBe("command");
  });
});

describe("slugify", () => {
  it.each([
    ["Problème", "probleme"],
    ["  Error Vault  ", "error-vault"],
    ["C# / .NET tips!", "c-net-tips"],
    ["Ça--marche__bien", "ca-marche-bien"],
    ["DB 2024", "db-2024"],
  ])("turns %j into %j", (name, slug) => {
    expect(slugify(name)).toBe(slug);
  });

  it.each([[""], ["   "], ["C"], ["+++"], ["🚀"]])("returns null for %j (fewer than 2 characters left)", (name) => {
    expect(slugify(name)).toBeNull();
  });

  it("caps the slug at 40 characters without a trailing dash", () => {
    const slug = slugify(`${"a".repeat(39)} ${"b".repeat(60)}`);
    expect(slug).toBe("a".repeat(39));
    expect(slugify("x".repeat(100))).toBe("x".repeat(40));
  });
});

describe("isReservedTypeSlug", () => {
  it.each(["snippet", "snippets", "link", "links", "image", "images", "new", "custom", "all"])("reserves %j", (slug) => {
    expect(isReservedTypeSlug(slug)).toBe(true);
  });

  it.each(["problem", "error-vault", "notes-2"])("allows %j", (slug) => {
    expect(isReservedTypeSlug(slug)).toBe(false);
  });
});

describe("typeSegmentFromPathname", () => {
  it("reads and decodes the segment after /items/", () => {
    expect(typeSegmentFromPathname("/items/problem")).toBe("problem");
    expect(typeSegmentFromPathname("/items/snippets/extra")).toBe("snippets");
    expect(typeSegmentFromPathname("/items/caf%C3%A9")).toBe("café");
  });

  it("is null elsewhere, or for a malformed segment", () => {
    expect(typeSegmentFromPathname("/dashboard")).toBeNull();
    expect(typeSegmentFromPathname("/items/%E0%A4%A")).toBeNull();
  });
});
