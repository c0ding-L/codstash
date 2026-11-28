// The /admin panel's reads and writes. Server-only. Account data and counts only: nothing here
// reads another user's items, collections or their content.

import { extendProUntil, hasProAccess, type Currency, type Role } from "@/lib/billing-plans";
import { lockUser } from "@/lib/db/user-lock";
import { pageOffset } from "@/lib/pagination";
import { prisma } from "@/lib/prisma";

/** Users per page on /admin. */
export const ADMIN_USERS_PER_PAGE = 25;

/** The longest search the user list takes; longer is cut. */
export const MAX_ADMIN_QUERY_LENGTH = 100;

const DAY_MS = 86_400_000;

/** Whether this user is an admin, read from the database: never from the session. */
export async function isAdminUser(userId: string): Promise<boolean> {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { role: true } });
  return user?.role === "ADMIN";
}

export interface AdminStats {
  users: number;
  verifiedUsers: number;
  /** Paid Pro still running; admins are not counted unless they paid. */
  activePro: number;
  signupsLast30Days: number;
  items: number;
  collections: number;
  /** Succeeded payments, summed per currency in major units; currencies with none left out. */
  revenue: { currency: Currency; amount: number; count: number }[];
}

export async function getAdminStats(now = new Date()): Promise<AdminStats> {
  const [users, verifiedUsers, activePro, signupsLast30Days, items, collections, revenue] = await Promise.all([
    prisma.user.count(),
    prisma.user.count({ where: { emailVerified: { not: null } } }),
    prisma.user.count({ where: { proUntil: { gt: now } } }),
    prisma.user.count({ where: { createdAt: { gte: new Date(now.getTime() - 30 * DAY_MS) } } }),
    prisma.item.count(),
    prisma.collection.count(),
    prisma.payment.groupBy({
      by: ["currency"],
      where: { status: "SUCCEEDED" },
      _sum: { amount: true },
      _count: { _all: true },
    }),
  ]);

  return {
    users,
    verifiedUsers,
    activePro,
    signupsLast30Days,
    items,
    collections,
    revenue: revenue
      .map((row) => ({ currency: row.currency, amount: row._sum.amount ?? 0, count: row._count._all }))
      .sort((a, b) => a.currency.localeCompare(b.currency)),
  };
}

export interface AdminUserRow {
  id: string;
  email: string;
  name: string | null;
  role: Role;
  createdAt: Date;
  verified: boolean;
  proUntil: Date | null;
  /** `hasProAccess`: admin, or paid Pro still running. */
  isPro: boolean;
  itemCount: number;
}

export interface AdminUserPage {
  rows: AdminUserRow[];
  total: number;
}

/** The users, newest first, matching `query` on email or name when given. */
export async function listAdminUsers(
  { query, page }: { query: string; page: number },
  now = new Date(),
): Promise<AdminUserPage> {
  const search = query.trim().slice(0, MAX_ADMIN_QUERY_LENGTH);
  const where = search
    ? {
        OR: [
          { email: { contains: search, mode: "insensitive" as const } },
          { name: { contains: search, mode: "insensitive" as const } },
        ],
      }
    : {};

  const [users, total] = await Promise.all([
    prisma.user.findMany({
      where,
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      skip: pageOffset(page, ADMIN_USERS_PER_PAGE),
      take: ADMIN_USERS_PER_PAGE,
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        createdAt: true,
        emailVerified: true,
        proUntil: true,
        _count: { select: { items: true } },
      },
    }),
    prisma.user.count({ where }),
  ]);

  return {
    rows: users.map(({ emailVerified, _count, ...user }) => ({
      ...user,
      verified: emailVerified != null,
      isPro: hasProAccess(user, now),
      itemCount: _count.items,
    })),
    total,
  };
}

/** What an admin action needs to know about its target, or null when the account is gone. */
export function findAdminTarget(userId: string) {
  return prisma.user.findUnique({ where: { id: userId }, select: { id: true, email: true, role: true } });
}

/**
 * Adds `days` of Pro, stacked on the time left like a payment. The row is locked so a payment
 * settling at the same moment queues up instead of both extending the same old date.
 * Null when the account is gone.
 */
export async function grantPro(userId: string, days: number, now = new Date()): Promise<Date | null> {
  return prisma.$transaction(async (tx) => {
    await lockUser(tx, userId);
    const user = await tx.user.findUnique({ where: { id: userId }, select: { proUntil: true } });
    if (!user) return null;
    const proUntil = extendProUntil(user.proUntil, days, now);
    await tx.user.update({ where: { id: userId }, data: { proUntil, isPro: true } });
    return proUntil;
  });
}

/** Ends paid Pro at once. False when the account is gone. An admin keeps Pro access through the role. */
export async function revokePro(userId: string): Promise<boolean> {
  const { count } = await prisma.user.updateMany({ where: { id: userId }, data: { proUntil: null, isPro: false } });
  return count > 0;
}
