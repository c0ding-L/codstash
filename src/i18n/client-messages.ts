import type { Messages } from "next-intl";

/**
 * Namespaces only the server reads (page titles and emails).
 * Everything else reaches the browser: an allowlist would let a client component that uses a
 * forgotten namespace build fine and then render raw keys.
 */
export const SERVER_ONLY_NAMESPACES = ["metadata", "emails"] as const;

type ServerOnly = (typeof SERVER_ONLY_NAMESPACES)[number];

export function pickMessages(messages: Messages): Omit<Messages, ServerOnly> {
  const serverOnly: readonly string[] = SERVER_ONLY_NAMESPACES;
  return Object.fromEntries(
    Object.entries(messages).filter(([namespace]) => !serverOnly.includes(namespace)),
  ) as Omit<Messages, ServerOnly>;
}
