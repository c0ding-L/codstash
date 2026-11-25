"use server";

import { cookies } from "next/headers";
import { z } from "zod";

import { auth } from "@/auth";
import { LOCALE_COOKIE, LOCALE_COOKIE_MAX_AGE, LOCALES } from "@/lib/locale";
import { prisma } from "@/lib/prisma";

export interface ActionResult {
  success: boolean;
  error: string | null;
}

const localeSchema = z.enum(LOCALES);

/**
 * Sets the interface language: always in the cookie, which every request reads, and on the
 * user's row when signed in, so a new device picks the choice back up. Works signed out too, for
 * the public pages' toggle.
 *
 * The caller refreshes the page; the error is a code so the client words it in its own language.
 */
export async function setLocale(locale: string): Promise<ActionResult> {
  const parsed = localeSchema.safeParse(locale);
  if (!parsed.success) return { success: false, error: "invalid_locale" };

  try {
    // The row first: a cookie set here re-renders the page in the new language, which must not
    // happen when the action then reports a failure.
    const session = await auth();
    if (session?.user?.id) {
      await prisma.user.update({ where: { id: session.user.id }, data: { locale: parsed.data } });
    }

    (await cookies()).set(LOCALE_COOKIE, parsed.data, {
      maxAge: LOCALE_COOKIE_MAX_AGE,
      path: "/",
      sameSite: "lax",
    });
  } catch (error) {
    console.error("[locale] update failed:", error);
    return { success: false, error: "save_failed" };
  }

  return { success: true, error: null };
}
