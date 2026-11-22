import { describe, expect, it } from "vitest";

import { sortFavoriteCollections, sortFavoriteItems } from "@/lib/favorites-sort";

const day = (n: number) => new Date(Date.UTC(2026, 10, n));

const item = (id: string, title: string, type: string, date: number) => ({
  id,
  title,
  type: { name: type },
  updatedAt: day(date),
});

const collection = (id: string, name: string, types: string[], date: number) => ({
  id,
  name,
  types: types.map((name) => ({ name })),
  updatedAt: day(date),
});

const ids = (rows: { id: string }[]) => rows.map((row) => row.id);

describe("sortFavoriteItems", () => {
  const items = [
    item("a", "beta", "Snippet", 1),
    item("b", "Alpha", "Prompt", 3),
    item("c", "gamma", "Command", 2),
    item("d", "alpha", "Snippet", 5),
  ];

  it("sorts by date, newest first", () => {
    expect(ids(sortFavoriteItems(items, "date"))).toEqual(["d", "b", "c", "a"]);
  });

  it("sorts by name ignoring case, ties newest first", () => {
    expect(ids(sortFavoriteItems(items, "name"))).toEqual(["d", "b", "a", "c"]);
  });

  it("sorts by type name, then by name", () => {
    expect(ids(sortFavoriteItems(items, "type"))).toEqual(["c", "b", "d", "a"]);
  });

  it("compares numbers in names naturally", () => {
    const rows = [item("x", "item 10", "Note", 1), item("y", "item 2", "Note", 1)];
    expect(ids(sortFavoriteItems(rows, "name"))).toEqual(["y", "x"]);
  });

  it("breaks equal dates on id so the order is stable", () => {
    const rows = [item("z", "same", "Note", 4), item("m", "same", "Note", 4)];
    expect(ids(sortFavoriteItems(rows, "date"))).toEqual(["m", "z"]);
    expect(ids(sortFavoriteItems(rows, "name"))).toEqual(["m", "z"]);
  });

  it("returns a copy and leaves the input alone", () => {
    const sorted = sortFavoriteItems(items, "name");
    expect(sorted).not.toBe(items);
    expect(ids(items)).toEqual(["a", "b", "c", "d"]);
  });
});

describe("sortFavoriteCollections", () => {
  const collections = [
    collection("a", "Work", ["Snippet", "Note"], 2),
    collection("b", "empty one", [], 4),
    collection("c", "Archive", ["Prompt"], 1),
    collection("d", "drafts", ["Note", "Snippet"], 3),
    collection("e", "another empty", [], 1),
  ];

  it("sorts by date, newest first", () => {
    expect(ids(sortFavoriteCollections(collections, "date"))).toEqual(["b", "d", "a", "c", "e"]);
  });

  it("sorts by name ignoring case", () => {
    expect(ids(sortFavoriteCollections(collections, "name"))).toEqual(["e", "c", "d", "b", "a"]);
  });

  it("sorts by most used type, empty collections last by name", () => {
    expect(ids(sortFavoriteCollections(collections, "type"))).toEqual(["d", "c", "a", "e", "b"]);
  });
});
