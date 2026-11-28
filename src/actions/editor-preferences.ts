"use server";

import { auth } from "@/auth";
import { getErrors } from "@/i18n/errors-server";
import type { SimpleActionResult } from "@/lib/action-result";
import { editorPreferencesSchema, type EditorPreferences } from "@/lib/editor-preferences";
import { prisma } from "@/lib/prisma";

export type ActionResult = SimpleActionResult;

/** Saves the whole set, so the last change sent wins and no field is left half-updated. */
export async function updateEditorPreferences(preferences: EditorPreferences): Promise<ActionResult> {
  const e = await getErrors();
  const parsed = editorPreferencesSchema.safeParse(preferences);
  if (!parsed.success) return { success: false, error: e.message("editorPreferences.invalid") };

  try {
    const session = await auth();
    if (!session?.user?.id) return { success: false, error: e.message("notSignedIn") };

    await prisma.user.update({
      where: { id: session.user.id },
      data: { editorPreferences: parsed.data },
    });
  } catch (error) {
    console.error("[editor-preferences] update failed:", error);
    return { success: false, error: e.message("editorPreferences.saveFailed") };
  }

  return { success: true, error: null };
}
