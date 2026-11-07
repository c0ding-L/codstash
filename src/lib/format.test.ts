import { describe, expect, it } from "vitest";

import { formatFileSize, formatRelativeTime } from "@/lib/format";

describe("formatRelativeTime", () => {
  const now = "2026-08-15T12:00:00.000Z";
  const ago = (ms: number) => new Date(Date.parse(now) - ms).toISOString();

  const MINUTE = 60_000;
  const HOUR = 60 * MINUTE;
  const DAY = 24 * HOUR;

  it.each([
    [0, "Just now"],
    [MINUTE - 1, "Just now"],
    [MINUTE, "1m ago"],
    [HOUR - 1, "59m ago"],
    [HOUR, "1h ago"],
    [DAY - 1, "23h ago"],
    [DAY, "Yesterday"],
    [2 * DAY - 1, "Yesterday"],
    [2 * DAY, "2d ago"],
    [7 * DAY - 1, "6d ago"],
    [7 * DAY, "1w ago"],
    [30 * DAY - 1, "4w ago"],
    [30 * DAY, "1mo ago"],
    [365 * DAY - 1, "12mo ago"],
    [365 * DAY, "1y ago"],
  ])("labels %d ms ago as %s", (elapsed, label) => {
    expect(formatRelativeTime(ago(elapsed), now)).toBe(label);
  });

  it("treats a timestamp in the future as just now", () => {
    expect(formatRelativeTime(ago(-HOUR), now)).toBe("Just now");
  });
});

describe("formatFileSize", () => {
  it.each([
    [0, "0 B"],
    [1023, "1023 B"],
    [1024, "1.0 KB"],
    [14_208, "13.9 KB"],
    [1024 * 1024, "1.0 MB"],
    [2_418_704, "2.3 MB"],
  ])("labels %d bytes as %s", (bytes, label) => {
    expect(formatFileSize(bytes)).toBe(label);
  });
});
