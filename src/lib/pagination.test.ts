import { describe, expect, it } from "vitest";

import {
  collectionIdFromPath,
  pageAfterRemoval,
  pageCount,
  pageLinks,
  pageOffset,
  parsePageParam,
} from "@/lib/pagination";

describe("parsePageParam", () => {
  it("reads a missing param as page 1", () => {
    expect(parsePageParam(undefined)).toBe(1);
  });

  it.each([
    ["1", 1],
    ["2", 2],
    ["40", 40],
  ])("reads %s as page %i", (raw, page) => {
    expect(parsePageParam(raw)).toBe(page);
  });

  it.each(["", "0", "-1", "1.5", "01", "abc", "2abc", " 2", "1e3", "99999999999999999999"])(
    "rejects %j",
    (raw) => {
      expect(parsePageParam(raw)).toBeNull();
    },
  );

  it("rejects a repeated param", () => {
    expect(parsePageParam(["1", "2"])).toBeNull();
  });
});

describe("pageCount", () => {
  it.each([
    [0, 1],
    [1, 1],
    [21, 1],
    [22, 2],
    [63, 3],
  ])("%i rows of 21 fill %i page(s)", (total, pages) => {
    expect(pageCount(total, 21)).toBe(pages);
  });
});

describe("pageOffset", () => {
  it("skips nothing on page 1 and a page's worth per page after", () => {
    expect(pageOffset(1, 21)).toBe(0);
    expect(pageOffset(3, 21)).toBe(42);
  });

  it.each([0, -1, 1.5, Number.NaN])("rejects page %d", (page) => {
    expect(() => pageOffset(page, 21)).toThrow(RangeError);
  });
});

describe("pageLinks", () => {
  it("shows a single page", () => {
    expect(pageLinks(1, 1)).toEqual([1]);
  });

  it("shows every page when there are few", () => {
    expect(pageLinks(1, 3)).toEqual([1, 2, 3]);
    expect(pageLinks(3, 5)).toEqual([1, 2, 3, 4, 5]);
  });

  it("puts gaps around the current page", () => {
    expect(pageLinks(6, 12)).toEqual([1, "ellipsis", 5, 6, 7, "ellipsis", 12]);
  });

  it("shows a one-page gap as that page, not an ellipsis", () => {
    expect(pageLinks(4, 10)).toEqual([1, 2, 3, 4, 5, "ellipsis", 10]);
  });

  it("handles the first and last pages", () => {
    expect(pageLinks(1, 10)).toEqual([1, 2, "ellipsis", 10]);
    expect(pageLinks(10, 10)).toEqual([1, "ellipsis", 9, 10]);
  });
});

describe("pageAfterRemoval", () => {
  it("steps back from a last page whose only row was removed", () => {
    expect(pageAfterRemoval(3, 3, ["a"], "a")).toBe(2);
    expect(pageAfterRemoval(2, 2, ["a"], "a")).toBe(1);
  });

  it("stays when the page still has rows", () => {
    expect(pageAfterRemoval(3, 3, ["a", "b"], "a")).toBeNull();
  });

  it("stays on a page that is not the last: rows from the next page move up", () => {
    expect(pageAfterRemoval(2, 3, ["a"], "a")).toBeNull();
  });

  it("stays on page 1, which always exists", () => {
    expect(pageAfterRemoval(1, 1, ["a"], "a")).toBeNull();
  });

  it("stays when the removed row is not on this page", () => {
    expect(pageAfterRemoval(3, 3, ["a"], "z")).toBeNull();
  });
});

describe("collectionIdFromPath", () => {
  it("reads the id of a collection page", () => {
    expect(collectionIdFromPath("/collections/col_1")).toBe("col_1");
    expect(collectionIdFromPath("/collections/col_1/")).toBe("col_1");
    expect(collectionIdFromPath("/collections/a%20b")).toBe("a b");
  });

  it.each(["/collections", "/collections/", "/items/notes", "/collections/col_1/edit", "/collections/%E0%A4%A"])(
    "is null for %s",
    (path) => {
      expect(collectionIdFromPath(path)).toBeNull();
    },
  );
});
