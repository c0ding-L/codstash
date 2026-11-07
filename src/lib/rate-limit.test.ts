import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { checkRateLimit, getClientIp, secondsUntil, tooManyAttemptsMessage } from "@/lib/rate-limit";

describe("getClientIp", () => {
  it("takes the first x-forwarded-for entry", () => {
    const headers = new Headers({ "x-forwarded-for": " 203.0.113.7 , 10.0.0.1", "x-real-ip": "10.0.0.2" });
    expect(getClientIp(headers)).toBe("203.0.113.7");
  });

  it("falls back to x-real-ip", () => {
    expect(getClientIp(new Headers({ "x-real-ip": " 203.0.113.8 " }))).toBe("203.0.113.8");
  });

  it("answers unknown without either header", () => {
    expect(getClientIp(new Headers())).toBe("unknown");
  });
});

describe("time until the limit resets", () => {
  const NOW = Date.parse("2026-08-15T12:00:00.000Z");

  beforeEach(() => {
    vi.useFakeTimers({ now: NOW });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("rounds up to whole seconds", () => {
    expect(secondsUntil(NOW + 1_001)).toBe(2);
  });

  it("never reports less than a second", () => {
    expect(secondsUntil(NOW - 5_000)).toBe(1);
  });

  it("uses the singular for one minute", () => {
    expect(tooManyAttemptsMessage(NOW + 60_000)).toBe("Too many attempts. Please try again in 1 minute.");
  });

  it("rounds a partial minute up and pluralises", () => {
    expect(tooManyAttemptsMessage(NOW + 61_000)).toBe("Too many attempts. Please try again in 2 minutes.");
  });
});

describe("checkRateLimit", () => {
  it("fails open when Upstash is not configured", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});

    const result = await checkRateLimit("signIn", "203.0.113.7:a@example.com");

    expect(result.success).toBe(true);
    expect(result.remaining).toBe(5);
    expect(warn).toHaveBeenCalledOnce();
  });
});
