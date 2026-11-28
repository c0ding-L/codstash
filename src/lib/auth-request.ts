// How the auth forms call the auth routes (`/api/auth/*`). Client-safe.

import { toast } from "sonner";

/** What every auth route answers with; each adds its own fields. */
export interface AuthRouteBody {
  success?: boolean;
  error?: string;
}

/**
 * POSTs `payload` as JSON and reads the answer, `{}` when it is not JSON. A 429 is shown as a
 * toast (the route's message, else `tooManyAttempts`) and gives null, so the form only handles
 * the other answers. A network failure throws, for the form to say the server is unreachable.
 */
export async function postAuthJson<T extends AuthRouteBody = AuthRouteBody>(
  url: string,
  payload: unknown,
  { tooManyAttempts }: { tooManyAttempts: string },
): Promise<{ ok: boolean; body: T } | null> {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const body = (await response.json().catch(() => ({}))) as T;
  if (response.status === 429) {
    toast.error(body.error ?? tooManyAttempts);
    return null;
  }
  return { ok: response.ok, body };
}
