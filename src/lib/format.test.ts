import { describe, expect, it } from "vitest";

import { createTranslator } from "next-intl";

import { formatCollectionNames, formatFileSize, relativeTime } from "@/lib/format";
import en from "../../messages/en.json";
import fr from "../../messages/fr.json";

describe("relativeTime", () => {
  const now = "2026-08-15T12:00:00.000Z";
  const ago = (ms: number) => new Date(Date.parse(now) - ms).toISOString();

  const MINUTE = 60_000;
  const HOUR = 60 * MINUTE;
  const DAY = 24 * HOUR;

  it.each([
    [0, "justNow", 0, "Just now", "À l’instant"],
    [MINUTE - 1, "justNow", 0, "Just now", "À l’instant"],
    [MINUTE, "minutes", 1, "1m ago", "il y a 1 min"],
    [HOUR - 1, "minutes", 59, "59m ago", "il y a 59 min"],
    [HOUR, "hours", 1, "1h ago", "il y a 1 h"],
    [DAY - 1, "hours", 23, "23h ago", "il y a 23 h"],
    [DAY, "yesterday", 1, "Yesterday", "Hier"],
    [2 * DAY - 1, "yesterday", 1, "Yesterday", "Hier"],
    [2 * DAY, "days", 2, "2d ago", "il y a 2 j"],
    [7 * DAY - 1, "days", 6, "6d ago", "il y a 6 j"],
    [7 * DAY, "weeks", 1, "1w ago", "il y a 1 sem."],
    [30 * DAY - 1, "weeks", 4, "4w ago", "il y a 4 sem."],
    [30 * DAY, "months", 1, "1mo ago", "il y a 1 mois"],
    [365 * DAY - 1, "months", 12, "12mo ago", "il y a 12 mois"],
    [365 * DAY, "years", 1, "1y ago", "il y a 1 an"],
    [2 * 365 * DAY, "years", 2, "2y ago", "il y a 2 ans"],
  ] as const)("buckets %d ms ago as %s %d", (elapsed, unit, count, english, french) => {
    const result = relativeTime(ago(elapsed), now);
    expect(result).toEqual({ unit, count });

    // The `time` messages word each bucket per language.
    expect(createTranslator({ locale: "en", messages: en, namespace: "time" })(unit, { count })).toBe(english);
    expect(createTranslator({ locale: "fr", messages: fr, namespace: "time" })(unit, { count })).toBe(french);
  });

  it("treats a timestamp in the future as just now", () => {
    expect(relativeTime(ago(-HOUR), now)).toEqual({ unit: "justNow", count: 0 });
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

  it.each([
    [0, "0 o"],
    [1023, "1023 o"],
    [1024, "1,0 Ko"],
    [14_208, "13,9 Ko"],
    [2_418_704, "2,3 Mo"],
  ])("labels %d bytes as %s in French", (bytes, label) => {
    expect(formatFileSize(bytes, "fr")).toBe(label);
  });
});

describe("formatCollectionNames", () => {
  it("joins the names in the order given", () => {
    expect(formatCollectionNames([{ name: "DevOps" }, { name: "React" }])).toBe("DevOps, React");
  });

  it("is null for an item in no collection", () => {
    expect(formatCollectionNames([])).toBeNull();
  });
});
