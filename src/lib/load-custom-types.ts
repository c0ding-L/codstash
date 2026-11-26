import { auth } from "@/auth";
import { getPlanStatus } from "@/lib/db/billing";
import { getCustomTypes } from "@/lib/db/item-types";
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
 * none, the safe side. `auth()` stays outside the `try`, like `loadUploadsAllowed`.
 */
export async function loadCustomTypes(): Promise<CustomTypeChoices> {
  const session = await auth();
  if (!session?.user?.id) return { canCreate: false, types: [] };
  try {
    const [plan, types] = await Promise.all([getPlanStatus(session.user.id), getCustomTypes(session.user.id)]);
    return {
      canCreate: canUseCustomTypes(plan),
      types: types.map(({ id, slug, name, icon, color, template }) => ({ id, slug, name, icon, color, template })),
    };
  } catch (error) {
    console.error("[layout] loading the custom types failed:", error);
    return { canCreate: false, types: [] };
  }
}
