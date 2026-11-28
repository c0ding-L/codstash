import { describe, expect, it } from "vitest";

import { prismaError } from "@/lib/__fixtures__/prisma";
import { isPrismaNotFound, isUniqueViolation, prismaErrorCode } from "@/lib/prisma-errors";

describe("prisma errors", () => {
  it("reads the code off any thrown value that has one", () => {
    expect(prismaErrorCode(prismaError("P2003"))).toBe("P2003");
    expect(prismaErrorCode({ code: "P2025" })).toBe("P2025");
    expect(prismaErrorCode(new Error("x"))).toBeUndefined();
    expect(prismaErrorCode(null)).toBeUndefined();
    expect(prismaErrorCode({ code: 42 })).toBeUndefined();
  });

  it("tells not found and unique violations apart", () => {
    expect(isPrismaNotFound(prismaError("P2025"))).toBe(true);
    expect(isPrismaNotFound(prismaError("P2002"))).toBe(false);
    expect(isUniqueViolation(prismaError("P2002"))).toBe(true);
    expect(isUniqueViolation("P2002")).toBe(false);
  });
});
