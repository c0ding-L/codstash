import { describe, expect, it } from "vitest";

import { addTag, toTags } from "@/lib/tags";

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

describe("addTag", () => {
  it("appends the tag to the typed tags", () => {
    expect(addTag("react, hooks", "state")).toBe("react, hooks, state");
    expect(addTag("", "state")).toBe("state");
  });

  it("does not add a tag the form already has, whatever its case", () => {
    expect(addTag("React, hooks", "react")).toBe("React, hooks");
  });
});
