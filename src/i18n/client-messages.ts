import type { Messages } from "next-intl";

/**
 * The namespaces client components read with `useTranslations`. Server-only text stays on the
 * server; add a namespace here when a client component starts using it.
 */
export const CLIENT_NAMESPACES = ["locales", "itemTypes", "search", "userMenu", "nav", "settings"] as const;

export function pickMessages(messages: Messages): Pick<Messages, (typeof CLIENT_NAMESPACES)[number]> {
  return Object.fromEntries(CLIENT_NAMESPACES.map((namespace) => [namespace, messages[namespace]])) as Pick<
    Messages,
    (typeof CLIENT_NAMESPACES)[number]
  >;
}
