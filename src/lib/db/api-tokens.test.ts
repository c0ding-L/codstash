import { beforeEach, describe, expect, it, vi, type Mock } from "vitest";

import { listApiTokens, touchApiToken } from "@/lib/db/api-tokens";
import { prisma } from "@/lib/prisma";

vi.mock("@/lib/prisma", () => ({ prisma: { $executeRaw: vi.fn(), apiToken: { findMany: vi.fn() } } }));

const asMock = (fn: unknown) => fn as Mock;

beforeEach(() => {
  asMock(prisma.$executeRaw).mockResolvedValue(1);
});

describe("touchApiToken", () => {
  it("throttles lastUsedAt to one write a minute in the query itself", async () => {
    expect(await touchApiToken("tok1")).toBe(true);
    const [strings, ...values] = asMock(prisma.$executeRaw).mock.calls[0] as [TemplateStringsArray, ...unknown[]];
    const sql = strings.join("?");
    expect(sql).toContain(`SET "lastUsedAt" = now()`);
    expect(sql).toContain(`"lastUsedAt" IS NULL OR "lastUsedAt" < now() - interval '1 minute'`);
    expect(values).toEqual(["tok1"]);
  });

  it("is false when throttled", async () => {
    asMock(prisma.$executeRaw).mockResolvedValue(0);
    expect(await touchApiToken("tok1")).toBe(false);
  });
});

describe("listApiTokens", () => {
  const base = { name: "CLI", prefix: "cstash_abcde", createdAt: new Date(0), lastUsedAt: null };

  it("lists tokens not revoked, expired ones included and flagged", async () => {
    asMock(prisma.apiToken.findMany).mockResolvedValue([
      { ...base, id: "a", scope: "write", expiresAt: null },
      { ...base, id: "b", scope: "read", expiresAt: new Date(Date.now() + 60_000) },
      { ...base, id: "c", scope: "read", expiresAt: new Date(Date.now() - 60_000) },
      { ...base, id: "d", scope: "admin", expiresAt: null },
    ]);

    const tokens = await listApiTokens("user1");

    expect(asMock(prisma.apiToken.findMany).mock.calls[0][0].where).toEqual({ userId: "user1", revokedAt: null });
    expect(tokens.map(({ id, scope, expired }) => [id, scope, expired])).toEqual([
      ["a", "write", false],
      ["b", "read", false],
      ["c", "read", true],
      ["d", "read", false],
    ]);
  });
});
