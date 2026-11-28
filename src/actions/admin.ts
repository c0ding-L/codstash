"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { auth } from "@/auth";
import { getErrors, type Errors } from "@/i18n/errors-server";
import type { SimpleActionResult } from "@/lib/action-result";
import { findAdminTarget, grantPro, isAdminUser, revokePro } from "@/lib/db/admin";
import { DEMO_USER_EMAIL } from "@/lib/db/collections";
import { deleteUserAndData } from "@/lib/db/delete-user";

/** The longest grant in one go: ten years. */
const MAX_GRANT_DAYS = 3650;

const targetSchema = z.object({ userId: z.string().trim().min(1).max(100) });

const grantSchema = targetSchema.extend({
  days: z.number().int().min(1, "admin.invalidDays").max(MAX_GRANT_DAYS, "admin.invalidDays"),
});

export type AdminTargetInput = z.input<typeof targetSchema>;
export type GrantProInput = z.input<typeof grantSchema>;

/**
 * The caller's id when they are an admin, read from the database on every call: server actions
 * can be called directly, so the page's gate is not enough.
 */
async function adminId(e: Errors): Promise<{ adminId: string } | { error: string }> {
  const session = await auth();
  if (!session?.user?.id) return { error: e.message("notSignedIn") };
  if (!(await isAdminUser(session.user.id))) return { error: e.message("admin.forbidden") };
  return { adminId: session.user.id };
}

const failed = (error: string): SimpleActionResult => ({ success: false, error });
const done = (): SimpleActionResult => {
  revalidatePath("/admin");
  return { success: true, error: null };
};

export async function grantProToUser(input: GrantProInput): Promise<SimpleActionResult> {
  const e = await getErrors();
  const caller = await adminId(e);
  if ("error" in caller) return failed(caller.error);
  const parsed = grantSchema.safeParse(input);
  if (!parsed.success) return failed(e.issue(parsed.error.issues[0]));

  try {
    const proUntil = await grantPro(parsed.data.userId, parsed.data.days);
    if (!proUntil) return failed(e.message("admin.userGone"));
  } catch (error) {
    console.error("[admin] grantProToUser failed:", error);
    return failed(e.message("admin.grantFailed"));
  }
  return done();
}

export async function revokeProFromUser(input: AdminTargetInput): Promise<SimpleActionResult> {
  const e = await getErrors();
  const caller = await adminId(e);
  if ("error" in caller) return failed(caller.error);
  const parsed = targetSchema.safeParse(input);
  if (!parsed.success) return failed(e.issue(parsed.error.issues[0]));

  try {
    if (!(await revokePro(parsed.data.userId))) return failed(e.message("admin.userGone"));
  } catch (error) {
    console.error("[admin] revokeProFromUser failed:", error);
    return failed(e.message("admin.revokeFailed"));
  }
  return done();
}

/**
 * Deletes another user's account and everything in it. Never an admin (the caller included),
 * so the panel can neither lock its owner out nor remove the last admin, and never the demo
 * account, which the dashboard reads for everyone.
 */
export async function deleteUserAccount(input: AdminTargetInput): Promise<SimpleActionResult> {
  const e = await getErrors();
  const caller = await adminId(e);
  if ("error" in caller) return failed(caller.error);
  const parsed = targetSchema.safeParse(input);
  if (!parsed.success) return failed(e.issue(parsed.error.issues[0]));

  try {
    const target = await findAdminTarget(parsed.data.userId);
    if (!target) return failed(e.message("admin.userGone"));
    if (target.id === caller.adminId || target.role === "ADMIN") return failed(e.message("admin.adminNotDeletable"));
    if (target.email === DEMO_USER_EMAIL) return failed(e.message("profile.demoNotDeletable"));

    await deleteUserAndData(target);
  } catch (error) {
    console.error("[admin] deleteUserAccount failed:", error);
    return failed(e.message("admin.deleteFailed"));
  }
  return done();
}
