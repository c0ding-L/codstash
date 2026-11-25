import type { Messages } from "next-intl";

/** Every leaf path of an object of messages, as "a.b.c". */
type LeafPaths<T, Prefix extends string = ""> = {
  [K in keyof T & string]: T[K] extends string ? `${Prefix}${K}` : LeafPaths<T[K], `${Prefix}${K}.`>;
}[keyof T & string];

/** A key of the `errors` messages, e.g. "items.titleTooLong". */
export type ErrorKey = LeafPaths<Messages["errors"]>;

/**
 * Marks a zod message (or any returned error) as a key of the `errors` messages, so a typo fails
 * the build. Schemas stay at module level with keys as their messages; the action translates the
 * first issue (`getErrors().issue`) in the request's language.
 */
export function errKey(key: ErrorKey): ErrorKey {
  return key;
}
