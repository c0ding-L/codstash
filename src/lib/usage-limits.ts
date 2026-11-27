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

/** The AI features (tag suggestions, …) are Pro-only. */
export function canUseAi(plan: Pick<PlanUsage, "isPro">) {
  return plan.isPro;
}

/** Exporting all data (JSON / ZIP) is sold with Pro. */
export function canExport(plan: Pick<PlanUsage, "isPro">) {
  return plan.isPro;
}

/** API tokens are read for Free; the `write` scope (creating one, and writing with one) is Pro. */
export function canUseApiWrite(plan: Pick<PlanUsage, "isPro">) {
  return plan.isPro;
}

/** Custom item types: creating or editing one, and creating items of one. Existing ones stay readable. */
export function canUseCustomTypes(plan: Pick<PlanUsage, "isPro">) {
  return plan.isPro;
}

/**
 * Thrown by the create queries when, re-counted under a lock, the Free limit
 * is already reached: two requests racing past the action's early check.
 */
export class LimitReachedError extends Error {
  constructor(readonly limit: "items" | "collections" | "customTypes" | "apiTokens") {
    // Internal: the action that catches it answers with the `errors.limits` message.
    super(`${limit} limit reached`);
    this.name = "LimitReachedError";
  }
}
