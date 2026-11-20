import { describe, expect, it } from "vitest";

import { toTags } from "@/lib/tags";

describe("toTags", () => {
  it("splits on commas and trims each tag", () => {
    expect(toTags(" react , hooks,ts ")).toEqual(["react", "hooks", "ts"]);
  });

  it("drops blanks and repeats, keeping the first occurrence's order", () => {
    expect(toTags("a,, ,b, a ,c,b")).toEqual(["a", "b", "c"]);
  });

  it("is empty for an empty or blank string", () => {
    expect(toTags("")).toEqual([]);
    expect(toTags(" , ,")).toEqual([]);
  });

  it("keeps case, so differently cased tags stay apart", () => {
    expect(toTags("React, react")).toEqual(["React", "react"]);
  });
});
