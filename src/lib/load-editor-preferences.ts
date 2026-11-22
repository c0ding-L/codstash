import { auth } from "@/auth";
import { getEditorPreferences } from "@/lib/db/profile";
import { DEFAULT_EDITOR_PREFERENCES, type EditorPreferences } from "@/lib/editor-preferences";

/**
 * The signed-in user's editor preferences, for the `(app)` layout to stream to the editors.
 * A failed read falls back to the defaults, as an editor would otherwise throw where it
 * reads the result. `auth()` stays outside the `try`: while prerendering, Next.js signals
 * dynamic rendering by throwing from it, and that must not be caught.
 */
export async function loadEditorPreferences(): Promise<EditorPreferences> {
  const session = await auth();
  if (!session?.user?.id) return DEFAULT_EDITOR_PREFERENCES;
  try {
    return await getEditorPreferences(session.user.id);
  } catch (error) {
    console.error("[layout] loading editor preferences failed:", error);
    return DEFAULT_EDITOR_PREFERENCES;
  }
}
