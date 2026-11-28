import { getPlanStatus } from "@/lib/db/billing";
import { getCustomTypes } from "@/lib/db/item-types";
import { loadForUser } from "@/lib/load-for-user";
import { canUseCustomTypes } from "@/lib/usage-limits";

/** A custom type as the New Item dialog offers it. */
export interface CustomTypeOption {
  id: string;
  slug: string;
  name: string;
  icon: string | null;
  color: string | null;
  template: string | null;
}

export interface CustomTypeChoices {
  /** False once Pro has lapsed: the types stay listed but disabled, marked Pro. */
  canCreate: boolean;
  types: CustomTypeOption[];
}

/**
 * The user's custom types for the New Item dialog, streamed from the `(app)` layout and the
 * type pages. UI only: `createItem` checks the plan and the owner again. A failed read offers
 * none, the safe side.
 */
export async function loadCustomTypes(): Promise<CustomTypeChoices> {
  return loadForUser(
    async (userId) => {
      const [plan, types] = await Promise.all([getPlanStatus(userId), getCustomTypes(userId)]);
      return {
        canCreate: canUseCustomTypes(plan),
        types: types.map(({ id, slug, name, icon, color, template }) => ({ id, slug, name, icon, color, template })),
      };
    },
    { canCreate: false, types: [] },
    "the custom types",
  );
}
