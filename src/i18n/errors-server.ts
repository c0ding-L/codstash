import { getTranslations } from "next-intl/server";

import type { ErrorKey } from "@/i18n/error-keys";

interface IssueLike {
  message?: string;
  /** Set by zod on a `too_big` issue: the `.max()` the input went past. */
  maximum?: number | bigint;
  /** Set by zod on a `too_small` issue. */
  minimum?: number | bigint;
}

/**
 * The `errors` messages in the request's language, for server actions and route handlers.
 * `issue` turns a zod issue whose message is an `ErrorKey` into its text, `{max}` included.
 */
export async function getErrors() {
  const t = await getTranslations("errors");

  const message = (key: ErrorKey, values?: Record<string, string | number>) => t(key, values);

  const issue = (found: IssueLike | undefined) => {
    const key = found?.message;
    if (!key || !t.has(key as ErrorKey)) return t("invalidInput");
    return t(key as ErrorKey, { max: Number(found?.maximum ?? 0), min: Number(found?.minimum ?? 0) });
  };

  return { message, issue };
}
