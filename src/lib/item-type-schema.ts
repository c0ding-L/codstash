import { z } from "zod";

import { errKey } from "@/i18n/error-keys";
import { CUSTOM_TYPE_LIMITS } from "@/lib/item-limits";
import { CUSTOM_COLOR_TOKENS, CUSTOM_TYPE_ICONS } from "@/lib/item-type-ui";

/*
 * A custom item type's fields, out of `src/actions/item-types.ts` (a "use server" file can
 * export only async functions), so import (A4) re-checks an export's types with the same rules.
 * The slug is derived from the name by the caller (`slugify`).
 */

const ICON_KEYS = Object.keys(CUSTOM_TYPE_ICONS) as [string, ...string[]];

export const itemTypeSchema = z.object({
  name: z
    .string({ error: errKey("itemTypes.nameRequired") })
    .trim()
    .min(1, errKey("itemTypes.nameRequired"))
    .max(CUSTOM_TYPE_LIMITS.name, errKey("itemTypes.nameTooLong")),
  icon: z.enum(ICON_KEYS, { error: errKey("itemTypes.invalidIcon") }),
  color: z.enum(CUSTOM_COLOR_TOKENS, { error: errKey("itemTypes.invalidColor") }),
  // Kept as typed, like an item's content; blank is no template.
  template: z.preprocess(
    (value) => (typeof value === "string" && !value.trim() ? null : value),
    z.string().max(CUSTOM_TYPE_LIMITS.template, errKey("itemTypes.templateTooLong")).nullable().optional(),
  ),
});
