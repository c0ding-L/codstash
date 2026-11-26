/** A route's error body, `{ error }`: its translated message, or null when it has none. */
export async function responseError(response: Response): Promise<string | null> {
  try {
    const body: unknown = await response.json();
    if (body && typeof body === "object" && "error" in body && typeof body.error === "string") return body.error;
  } catch {
    // Not JSON: the caller's generic message.
  }
  return null;
}
