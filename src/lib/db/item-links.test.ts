import { describe, expect, it } from "vitest";

import { collectionLinks, tagLinks, tagNames } from "@/lib/db/item-links";

describe("tagNames", () => {
  it("sorts the names with localeCompare, mixed case and accents included", () => {
    const links = ["Zsh", "émoji", "bash", "Docker"].map((name) => ({ tag: { name } }));
    expect(tagNames(links)).toEqual(["bash", "Docker", "émoji", "Zsh"]);
  });
});

describe("tagLinks", () => {
  it("links each distinct name to the user's tag, created if missing", () => {
    expect(tagLinks("u1", ["a", "a", "b"])).toEqual([
      { tag: { connectOrCreate: { where: { userId_name: { userId: "u1", name: "a" } }, create: { name: "a", userId: "u1" } } } },
      { tag: { connectOrCreate: { where: { userId_name: { userId: "u1", name: "b" } }, create: { name: "b", userId: "u1" } } } },
    ]);
  });
});

describe("collectionLinks", () => {
  it("connects each distinct collection once", () => {
    expect(collectionLinks(["c1", "c1", "c2"])).toEqual([
      { collection: { connect: { id: "c1" } } },
      { collection: { connect: { id: "c2" } } },
    ]);
  });
});
