import { auth } from "@/auth";

/**
 * Reads something for the signed-in user, for the `(app)` layout to stream: `fallback`
 * without a user or when the read fails, so a failure only hides what it would show.
 * `auth()` stays outside the `try`: while prerendering, Next.js signals dynamic rendering
 * by throwing from it, and that must not be caught.
 */
export async function loadForUser<T>(read: (userId: string) => Promise<T>, fallback: T, what: string): Promise<T> {
  const session = await auth();
  if (!session?.user?.id) return fallback;
  try {
    return await read(session.user.id);
  } catch (error) {
    console.error(`[layout] loading ${what} failed:`, error);
    return fallback;
  }
}
