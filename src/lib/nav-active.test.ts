import { describe, expect, it } from "vitest";

import { isNavActive } from "./nav-active";

describe("isNavActive", () => {
  it("matches the same path", () => {
    expect(isNavActive("/items/snippets", "/items/snippets")).toBe(true);
    expect(isNavActive("/collections", "/collections", true)).toBe(true);
  });

  it("matches a sub-path unless exact", () => {
    expect(isNavActive("/collections/abc", "/collections/abc")).toBe(true);
    expect(isNavActive("/items/snippets/x", "/items/snippets")).toBe(true);
    expect(isNavActive("/collections/abc", "/collections", true)).toBe(false);
  });

  it("does not match on a partial segment", () => {
    expect(isNavActive("/items/notes-archive", "/items/notes")).toBe(false);
  });

  it("does not match another page", () => {
    expect(isNavActive("/dashboard", "/favorites", true)).toBe(false);
  });
});
