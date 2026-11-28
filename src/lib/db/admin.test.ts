import { beforeEach, describe, expect, it, vi, type Mock } from "vitest";

import { getAdminStats, grantPro, isAdminUser, listAdminUsers, revokePro } from "@/lib/db/admin";
import { prisma } from "@/lib/prisma";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    $transaction: vi.fn(),
    $queryRaw: vi.fn(),
    user: { findUnique: vi.fn(), findMany: vi.fn(), count: vi.fn(), update: vi.fn(), updateMany: vi.fn() },
    item: { count: vi.fn() },
    collection: { count: vi.fn() },
    payment: { groupBy: vi.fn() },
  },
}));

const asMock = (fn: unknown) => fn as Mock;
const DAY_MS = 86_400_000;
const NOW = new Date("2026-11-28T12:00:00Z");

beforeEach(() => {
  // The interactive transaction runs its callback against the same mocked client.
  asMock(prisma.$transaction).mockImplementation((run: (tx: typeof prisma) => unknown) => run(prisma));
});

describe("isAdminUser", () => {
  it("reads the role from the database", async () => {
    asMock(prisma.user.findUnique).mockResolvedValue({ role: "ADMIN" });
    expect(await isAdminUser("u1")).toBe(true);
    asMock(prisma.user.findUnique).mockResolvedValue({ role: "USER" });
    expect(await isAdminUser("u1")).toBe(false);
    asMock(prisma.user.findUnique).mockResolvedValue(null);
    expect(await isAdminUser("u1")).toBe(false);
  });
});

describe("getAdminStats", () => {
  it("counts accounts and sums succeeded payments per currency", async () => {
    asMock(prisma.user.count).mockResolvedValueOnce(10).mockResolvedValueOnce(8).mockResolvedValueOnce(2).mockResolvedValueOnce(3);
    asMock(prisma.item.count).mockResolvedValue(120);
    asMock(prisma.collection.count).mockResolvedValue(14);
    asMock(prisma.payment.groupBy).mockResolvedValue([
      { currency: "XOF", _sum: { amount: 8000 }, _count: { _all: 2 } },
      { currency: "EUR", _sum: { amount: 7 }, _count: { _all: 1 } },
    ]);

    expect(await getAdminStats(NOW)).toEqual({
      users: 10,
      verifiedUsers: 8,
      activePro: 2,
      signupsLast30Days: 3,
      items: 120,
      collections: 14,
      revenue: [
        { currency: "EUR", amount: 7, count: 1 },
        { currency: "XOF", amount: 8000, count: 2 },
      ],
    });
    const counts = asMock(prisma.user.count).mock.calls.map((call) => call[0]?.where);
    expect(counts[2]).toEqual({ proUntil: { gt: NOW } });
    expect(counts[3]).toEqual({ createdAt: { gte: new Date(NOW.getTime() - 30 * DAY_MS) } });
    expect(asMock(prisma.payment.groupBy).mock.calls[0]![0].where).toEqual({ status: "SUCCEEDED" });
  });
});

describe("listAdminUsers", () => {
  it("searches email and name, and reads no content", async () => {
    asMock(prisma.user.findMany).mockResolvedValue([
      {
        id: "u1",
        email: "ada@example.com",
        name: "Ada",
        role: "USER",
        createdAt: NOW,
        emailVerified: NOW,
        proUntil: new Date(NOW.getTime() + DAY_MS),
        _count: { items: 4 },
      },
      { id: "u2", email: "me@example.com", name: null, role: "ADMIN", createdAt: NOW, emailVerified: null, proUntil: null, _count: { items: 0 } },
    ]);
    asMock(prisma.user.count).mockResolvedValue(2);

    const result = await listAdminUsers({ query: "  ada ", page: 2 }, NOW);

    expect(result.total).toBe(2);
    expect(result.rows).toEqual([
      expect.objectContaining({ id: "u1", verified: true, isPro: true, itemCount: 4 }),
      expect.objectContaining({ id: "u2", verified: false, isPro: true, itemCount: 0 }),
    ]);
    const args = asMock(prisma.user.findMany).mock.calls[0]![0];
    expect(args.where).toEqual({
      OR: [
        { email: { contains: "ada", mode: "insensitive" } },
        { name: { contains: "ada", mode: "insensitive" } },
      ],
    });
    expect(args.skip).toBe(25);
    expect(Object.keys(args.select)).not.toContain("items");
  });

  it("lists everyone without a query", async () => {
    asMock(prisma.user.findMany).mockResolvedValue([]);
    asMock(prisma.user.count).mockResolvedValue(0);
    await listAdminUsers({ query: "", page: 1 }, NOW);
    expect(asMock(prisma.user.findMany).mock.calls[0]![0].where).toEqual({});
  });
});

describe("grantPro", () => {
  it("stacks the days on the time left, under the user lock", async () => {
    const proUntil = new Date(NOW.getTime() + 10 * DAY_MS);
    asMock(prisma.user.findUnique).mockResolvedValue({ proUntil });

    const result = await grantPro("u1", 30, NOW);

    expect(result).toEqual(new Date(proUntil.getTime() + 30 * DAY_MS));
    expect(prisma.$queryRaw).toHaveBeenCalled();
    expect(prisma.user.update).toHaveBeenCalledWith({ where: { id: "u1" }, data: { proUntil: result, isPro: true } });
  });

  it("is null when the account is gone", async () => {
    asMock(prisma.user.findUnique).mockResolvedValue(null);
    expect(await grantPro("u1", 30, NOW)).toBeNull();
    expect(prisma.user.update).not.toHaveBeenCalled();
  });
});

describe("revokePro", () => {
  it("clears proUntil and the mirror", async () => {
    asMock(prisma.user.updateMany).mockResolvedValue({ count: 1 });
    expect(await revokePro("u1")).toBe(true);
    expect(prisma.user.updateMany).toHaveBeenCalledWith({ where: { id: "u1" }, data: { proUntil: null, isPro: false } });

    asMock(prisma.user.updateMany).mockResolvedValue({ count: 0 });
    expect(await revokePro("u1")).toBe(false);
  });
});
