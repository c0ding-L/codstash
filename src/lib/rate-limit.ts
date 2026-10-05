import { Ratelimit, type Duration } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";
import { NextResponse } from "next/server";

const LIMITS = {
  signIn: { attempts: 5, window: "15 m" },
  register: { attempts: 3, window: "1 h" },
  forgotPassword: { attempts: 3, window: "1 h" },
  resetPassword: { attempts: 5, window: "15 m" },
  resendVerification: { attempts: 3, window: "15 m" },
} satisfies Record<string, { attempts: number; window: Duration }>;

export type RateLimitName = keyof typeof LIMITS;

export interface RateLimitResult {
  success: boolean;
  remaining: number;
  /** When the window frees up again, in milliseconds since the epoch. */
  reset: number;
}

/** A slow Upstash lets the request through after this long. */
const TIMEOUT_MS = 2000;

/**
 * Built on first use rather than at import, so missing env vars mean "no
 * limiting" instead of a crash. Kept at module level so each limiter's
 * in-memory cache of blocked keys survives between requests.
 */
let limiters: Map<RateLimitName, Ratelimit> | null | undefined;

function getLimiter(name: RateLimitName) {
  if (limiters === undefined) {
    const url = process.env.UPSTASH_REDIS_REST_URL;
    const token = process.env.UPSTASH_REDIS_REST_TOKEN;
    if (!url || !token) {
      console.warn("[rate-limit] UPSTASH_REDIS_REST_URL / TOKEN not set; auth rate limiting is off.");
      limiters = null;
    } else {
      const redis = new Redis({ url, token });
      limiters = new Map(
        Object.entries(LIMITS).map(([key, { attempts, window }]) => [
          key as RateLimitName,
          new Ratelimit({
            redis,
            limiter: Ratelimit.slidingWindow(attempts, window),
            prefix: `codstash:ratelimit:${key}`,
            timeout: TIMEOUT_MS,
          }),
        ]),
      );
    }
  }
  return limiters?.get(name) ?? null;
}

/**
 * Counts one attempt for `identifier` against the named limit. Fails open: if
 * Upstash is not configured, unreachable or erroring, the attempt is allowed.
 */
export async function checkRateLimit(name: RateLimitName, identifier: string): Promise<RateLimitResult> {
  const allowed = { success: true, remaining: LIMITS[name].attempts, reset: Date.now() };
  const limiter = getLimiter(name);
  if (!limiter) return allowed;

  try {
    const { success, remaining, reset } = await limiter.limit(identifier);
    return { success, remaining, reset };
  } catch (error) {
    console.error(`[rate-limit] ${name} check failed, allowing the request:`, error);
    return allowed;
  }
}

/** The caller's IP: the first `x-forwarded-for` entry on Vercel, else `x-real-ip`. */
export function getClientIp(headers: Headers) {
  const forwarded = headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return forwarded || headers.get("x-real-ip")?.trim() || "unknown";
}

/** Whole seconds until `reset`, at least 1. */
export function secondsUntil(reset: number) {
  return Math.max(1, Math.ceil((reset - Date.now()) / 1000));
}

export function tooManyAttemptsMessage(reset: number) {
  const minutes = Math.ceil(secondsUntil(reset) / 60);
  return `Too many attempts. Please try again in ${minutes} minute${minutes === 1 ? "" : "s"}.`;
}

/** The 429 the auth API routes answer with once a limit is hit. */
export function tooManyAttemptsResponse(reset: number) {
  return NextResponse.json(
    { success: false, error: tooManyAttemptsMessage(reset) },
    { status: 429, headers: { "Retry-After": String(secondsUntil(reset)) } },
  );
}
