"use server";

import bcrypt from "bcryptjs";
import { redirect } from "next/navigation";
import { z } from "zod";

import { auth, signIn, signOut } from "@/auth";
import { errKey } from "@/i18n/error-keys";
import { getErrors, type Errors } from "@/i18n/errors-server";
import type { SimpleActionResult } from "@/lib/action-result";
import { MIN_PASSWORD_LENGTH } from "@/lib/auth-rules";
import { revokeAllApiTokensQuery } from "@/lib/db/api-tokens";
import { DEMO_USER_EMAIL } from "@/lib/db/collections";
import { getItemFileKeys } from "@/lib/db/items";
import { resetIdentifier, verificationIdentifier } from "@/lib/email-token";
import { hashPassword } from "@/lib/password-hash";
import { prisma } from "@/lib/prisma";
import { deleteObjectsQuietly } from "@/lib/r2";
import { checkRateLimit, tooManyAttemptsMessage } from "@/lib/rate-limit";

export type ActionResult = SimpleActionResult;

/**
 * The signed-in user's id, under the `reauth` limit, which caps password guesses from a
 * session that is not its owner's.
 */
async function reauthUserId(e: Errors): Promise<{ userId: string } | { error: string }> {
  const session = await auth();
  if (!session?.user?.id) return { error: e.message("notSignedIn") };
  const limit = await checkRateLimit("reauth", session.user.id);
  if (!limit.success) return { error: await tooManyAttemptsMessage(limit.reset) };
  return { userId: session.user.id };
}

const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, errKey("profile.currentPasswordRequired")),
    newPassword: z.string().min(MIN_PASSWORD_LENGTH, errKey("profile.newPasswordTooShort")),
    confirmPassword: z.string(),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: errKey("profile.passwordsDontMatch"),
    path: ["confirmPassword"],
  });

export async function changePassword(_previous: ActionResult, formData: FormData): Promise<ActionResult> {
  const e = await getErrors();
  const parsed = changePasswordSchema.safeParse({
    currentPassword: formData.get("currentPassword"),
    newPassword: formData.get("newPassword"),
    confirmPassword: formData.get("confirmPassword"),
  });
  if (!parsed.success) return { success: false, error: e.issue(parsed.error.issues[0]) };

  let email: string;
  try {
    const caller = await reauthUserId(e);
    if ("error" in caller) return { success: false, error: caller.error };

    const user = await prisma.user.findUnique({ where: { id: caller.userId } });
    if (!user?.password) return { success: false, error: e.message("profile.noPassword") };

    if (!(await bcrypt.compare(parsed.data.currentPassword, user.password))) {
      return { success: false, error: e.message("profile.currentPasswordWrong") };
    }

    await prisma.$transaction([
      prisma.user.update({
        where: { id: user.id },
        // Ends every session signed in before now, this one included.
        data: {
          password: await hashPassword(parsed.data.newPassword),
          passwordChangedAt: new Date(),
        },
      }),
      // A reset link requested earlier would otherwise still set a password.
      prisma.verificationToken.deleteMany({ where: { identifier: resetIdentifier(user.email) } }),
      // The same "I may be compromised" step covers the API tokens (C1).
      revokeAllApiTokensQuery(user.id),
    ]);
    email = user.email;
  } catch (error) {
    console.error("[profile] changePassword failed:", error);
    return { success: false, error: e.message("profile.changeFailed") };
  }

  // Signs this browser in again, so only the other sessions end. If that
  // fails, this session has ended too, so clear it and go to sign-in.
  try {
    await signIn("credentials", { email, password: parsed.data.newPassword, redirect: false });
  } catch (error) {
    console.error("[profile] signing in again after the password change failed:", error);
    await signOut({ redirectTo: "/sign-in" });
  }
  // Re-rendering this page in place would still read the old, now ended,
  // session from the request headers; a redirect carries the new cookie.
  redirect("/profile?passwordChanged=1");
}

const deleteAccountSchema = z.object({
  confirmEmail: z.string().trim().toLowerCase().min(1, errKey("profile.confirmEmailRequired")),
  // Null when the field is absent, as on the form for GitHub-only accounts.
  password: z.string().nullable(),
});

export async function deleteAccount(_previous: ActionResult, formData: FormData): Promise<ActionResult> {
  const e = await getErrors();
  const parsed = deleteAccountSchema.safeParse({
    confirmEmail: formData.get("confirmEmail"),
    password: formData.get("password"),
  });
  if (!parsed.success) return { success: false, error: e.issue(parsed.error.issues[0]) };

  try {
    const caller = await reauthUserId(e);
    if ("error" in caller) return { success: false, error: caller.error };

    const user = await prisma.user.findUnique({
      where: { id: caller.userId },
      select: { id: true, email: true, password: true },
    });
    if (!user) return { success: false, error: e.message("profile.accountGone") };

    // The dashboard still reads the demo account's data for everyone.
    if (user.email === DEMO_USER_EMAIL) {
      return { success: false, error: e.message("profile.demoNotDeletable") };
    }
    const email = user.email.toLowerCase();
    if (parsed.data.confirmEmail !== email) {
      return { success: false, error: e.message("profile.emailMismatch") };
    }
    // The email is on the profile page, so on its own it proves nothing about who
    // holds the session. GitHub-only accounts have no password to ask for.
    if (user.password) {
      const { password } = parsed.data;
      if (!password || !(await bcrypt.compare(password, user.password))) {
        return { success: false, error: e.message("profile.passwordWrong") };
      }
    }

    // Read before the items go: the cascade would lose the R2 keys.
    const fileKeys = await getItemFileKeys(user.id);

    await prisma.$transaction([
      // Items first: `Item.typeId` is `Restrict`, and the user's custom types
      // are deleted by the same cascade as their items.
      prisma.item.deleteMany({ where: { userId: user.id } }),
      // No foreign key on tokens, so the cascade does not reach them.
      prisma.verificationToken.deleteMany({
        where: { identifier: { in: [verificationIdentifier(email), resetIdentifier(email)] } },
      }),
      prisma.user.delete({ where: { id: user.id } }),
    ]);

    await deleteObjectsQuietly(fileKeys);
  } catch (error) {
    console.error("[profile] deleteAccount failed:", error);
    return { success: false, error: e.message("profile.deleteFailed") };
  }

  // Outside the try: signOut redirects by throwing.
  await signOut({ redirectTo: "/sign-in" });
  return { success: true, error: null };
}
