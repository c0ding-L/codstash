// The checks shared by the AI server actions (Tags, Description) and the streamed AI routes
// (Explain, Optimize). Server-only: it reads the plan and the rate limits.

import { getLocale } from "next-intl/server";

import type { Errors } from "@/i18n/errors-server";
import { getPlanStatus } from "@/lib/db/billing";
import { DEFAULT_LOCALE, isLocale, type Locale } from "@/lib/locale";
import { checkRateLimit, tooManyAttemptsMessage } from "@/lib/rate-limit";
import { canUseAi } from "@/lib/usage-limits";

/** Why a call may not go ahead: the message to show, and the HTTP status a route answers with. */
export interface AiGateRefusal {
  status: 403 | 429;
  error: string;
}

/**
 * The checks every AI call makes after auth: Pro first, so Free users spend
 * no limiter slots, then the per-user, daily and app-wide limits. The refusal,
 * or null to go ahead.
 */
export async function aiGate(userId: string, e: Errors): Promise<AiGateRefusal | null> {
  if (!canUseAi(await getPlanStatus(userId))) return { status: 403, error: e.message("limits.ai") };

  const hourly = await checkRateLimit("ai", userId);
  if (!hourly.success) return { status: 429, error: await tooManyAttemptsMessage(hourly.reset) };
  const daily = await checkRateLimit("aiDaily", userId);
  if (!daily.success) return { status: 429, error: e.message("ai.dailyLimit") };
  const global = await checkRateLimit("aiGlobal", "global");
  if (!global.success) return { status: 429, error: e.message("ai.busy") };
  return null;
}

/** The UI language, which the prose answers (Explain, Description) are written in. */
export async function answerLocale(): Promise<Locale> {
  const locale = await getLocale();
  return isLocale(locale) ? locale : DEFAULT_LOCALE;
}
