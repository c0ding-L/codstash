"use server";

import { auth } from "@/auth";
import { editorPreferencesSchema, type EditorPreferences } from "@/lib/editor-preferences";
import { prisma } from "@/lib/prisma";

export interface ActionResult {
  success: boolean;
  error: string | null;
}

/** Saves the whole set, so the last change sent wins and no field is left half-updated. */
export async function updateEditorPreferences(preferences: EditorPreferences): Promise<ActionResult> {
  const parsed = editorPreferencesSchema.safeParse(preferences);
  if (!parsed.success) return { success: false, error: "Invalid editor preferences." };

  try {
    const session = await auth();
    if (!session?.user?.id) return { success: false, error: "You are not signed in." };

    await prisma.user.update({
      where: { id: session.user.id },
      data: { editorPreferences: parsed.data },
    });
  } catch (error) {
    console.error("[editor-preferences] update failed:", error);
    return { success: false, error: "Could not save your editor preferences. Try again." };
  }

  return { success: true, error: null };
}
