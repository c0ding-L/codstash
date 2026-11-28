import { describe, expect, it, vi } from "vitest";

import { resetIdentifier, verificationIdentifier } from "@/lib/email-token";

vi.mock("@/lib/prisma", () => ({ prisma: {} }));

describe("token identifiers", () => {
  it("builds both from the trimmed, lowercased address", () => {
    expect(verificationIdentifier(" Ada@Example.com ")).toBe("ada@example.com");
    expect(resetIdentifier(" Ada@Example.com ")).toBe("reset@ada@example.com");
  });

  it("never lets a reset identifier equal a verification one", () => {
    expect(resetIdentifier("ada@example.com")).not.toBe(verificationIdentifier("ada@example.com"));
  });
});
