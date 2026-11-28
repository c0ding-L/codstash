import type { PlanStatus } from "@/lib/db/billing";

/** A plan status for `getPlanStatus` mocks: Free, empty, unless overridden. Pro with `pro()`. */
export function plan(overrides: Partial<PlanStatus> = {}): PlanStatus {
  return { proUntil: null, isPro: false, items: 0, collections: 0, ...overrides };
}

/** An active Pro plan. */
export function pro(overrides: Partial<PlanStatus> = {}): PlanStatus {
  return plan({ proUntil: new Date(Date.now() + 86_400_000), isPro: true, ...overrides });
}
