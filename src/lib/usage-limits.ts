// The Free plan rules, pure and client-safe, so the Phase 2 gates and UI share
// one source. Not to be confused with `src/lib/db/limits.ts` (list ceilings).

export const FREE_LIMITS = { items: 50, collections: 3 } as const;

/** The `getPlanStatus` shape, minus `proUntil`. */
export interface PlanUsage {
  isPro: boolean;
  items: number;
  collections: number;
}

export function canCreateItem(plan: PlanUsage) {
  return plan.isPro || plan.items < FREE_LIMITS.items;
}

export function canCreateCollection(plan: PlanUsage) {
  return plan.isPro || plan.collections < FREE_LIMITS.collections;
}

/** File and image uploads are Pro-only. */
export function canUploadFiles(plan: Pick<PlanUsage, "isPro">) {
  return plan.isPro;
}

/** Shared wording for the actions and the upload route. */
export const LIMIT_MESSAGES = {
  items: `Free accounts can have ${FREE_LIMITS.items} items. Upgrade to Pro in Settings.`,
  collections: `Free accounts can have ${FREE_LIMITS.collections} collections. Upgrade to Pro in Settings.`,
  uploads: "File and image uploads are a Pro feature.",
} as const;

/**
 * Thrown by the create queries when, re-counted under a lock, the Free limit
 * is already reached: two requests racing past the action's early check.
 */
export class LimitReachedError extends Error {
  constructor(readonly limit: "items" | "collections") {
    super(LIMIT_MESSAGES[limit]);
    this.name = "LimitReachedError";
  }
}
