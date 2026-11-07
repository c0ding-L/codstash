import { describe, expect, it } from "vitest";

import { clampLimit } from "@/lib/db/limits";

describe("clampLimit", () => {
  it("keeps a limit within the ceiling", () => {
    expect(clampLimit(1, 50)).toBe(1);
    expect(clampLimit(50, 50)).toBe(50);
  });

  it("clamps a limit above the ceiling", () => {
    expect(clampLimit(51, 50)).toBe(50);
  });

  // Prisma reads a negative `take` as "count backwards", which would silently
  // flip the order of the results.
  it.each([0, -5, 1.5, Number.NaN, Number.POSITIVE_INFINITY])("rejects %d", (limit) => {
    expect(() => clampLimit(limit, 50)).toThrow(RangeError);
  });
});
