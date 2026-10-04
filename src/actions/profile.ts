"use server";

import bcrypt from "bcryptjs";
import { z } from "zod";

import { auth, signOut } from "@/auth";
import { DEMO_USER_EMAIL } from "@/lib/db/collections";
import { prisma } from "@/lib/prisma";

const BCRYPT_ROUNDS = 12;
const MIN_PASSWORD_LENGTH = 8;

export interface ActionResult {
  success: boolean;
  error: string | null;
}

const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, "Enter your current password."),
    newPassword: z
      .string()
      .min(MIN_PASSWORD_LENGTH, `New password must be at least ${MIN_PASSWORD_LENGTH} characters.`),
    confirmPassword: z.string(),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: "Passwords do not match.",
    path: ["confirmPassword"],
  });

export async function changePassword(_previous: ActionResult, formData: FormData): Promise<ActionResult> {
  const parsed = changePasswordSchema.safeParse({
    currentPassword: formData.get("currentPassword"),
    newPassword: formData.get("newPassword"),
    confirmPassword: formData.get("confirmPassword"),
  });
  if (!parsed.success) return { success: false, error: parsed.error.issues[0]?.message ?? "Invalid input." };

  try {
    const session = await auth();
    if (!session?.user?.id) return { success: false, error: "You are not signed in." };

    const user = await prisma.user.findUnique({ where: { id: session.user.id } });
    if (!user?.password) return { success: false, error: "This account has no password to change." };

    if (!(await bcrypt.compare(parsed.data.currentPassword, user.password))) {
      return { success: false, error: "Current password is incorrect." };
    }

    await prisma.$transaction([
      prisma.user.update({
        where: { id: user.id },
        data: { password: await bcrypt.hash(parsed.data.newPassword, BCRYPT_ROUNDS) },
      }),
      // A reset link requested earlier would otherwise still set a password.
      prisma.verificationToken.deleteMany({ where: { identifier: `reset@${user.email.toLowerCase()}` } }),
    ]);
    return { success: true, error: null };
  } catch (error) {
    console.error("[profile] changePassword failed:", error);
    return { success: false, error: "Could not change the password. Try again." };
  }
}

const deleteAccountSchema = z.object({
  confirmEmail: z.string().trim().toLowerCase().min(1, "Type your email to confirm."),
});

export async function deleteAccount(_previous: ActionResult, formData: FormData): Promise<ActionResult> {
  const parsed = deleteAccountSchema.safeParse({ confirmEmail: formData.get("confirmEmail") });
  if (!parsed.success) return { success: false, error: parsed.error.issues[0]?.message ?? "Invalid input." };

  try {
    const session = await auth();
    if (!session?.user?.id) return { success: false, error: "You are not signed in." };

    const user = await prisma.user.findUnique({ where: { id: session.user.id }, select: { id: true, email: true } });
    if (!user) return { success: false, error: "This account no longer exists." };

    // The dashboard still reads the demo account's data for everyone.
    if (user.email === DEMO_USER_EMAIL) {
      return { success: false, error: "The demo account cannot be deleted." };
    }
    const email = user.email.toLowerCase();
    if (parsed.data.confirmEmail !== email) {
      return { success: false, error: "The email does not match your account." };
    }

    await prisma.$transaction([
      // Items first: `Item.typeId` is `Restrict`, and the user's custom types
      // are deleted by the same cascade as their items.
      prisma.item.deleteMany({ where: { userId: user.id } }),
      // No foreign key on tokens, so the cascade does not reach them.
      prisma.verificationToken.deleteMany({
        // Token identifiers are always built from the lowercased address.
        where: { identifier: { in: [email, `reset@${email}`] } },
      }),
      prisma.user.delete({ where: { id: user.id } }),
    ]);
  } catch (error) {
    console.error("[profile] deleteAccount failed:", error);
    return { success: false, error: "Could not delete the account. Try again." };
  }

  // Outside the try: signOut redirects by throwing.
  await signOut({ redirectTo: "/sign-in" });
  return { success: true, error: null };
}
