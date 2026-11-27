import { createTranslator } from "next-intl";
import { describe, expect, it } from "vitest";

import enMessages from "../../messages/en.json";
import frMessages from "../../messages/fr.json";
import {
  FREE_LIMITS,
  canCreateCollection,
  canCreateItem,
  canShare,
  canUploadFiles,
  canUseAi,
} from "@/lib/usage-limits";

const free = (items = 0, collections = 0) => ({ isPro: false, items, collections });
const pro = (items = 0, collections = 0) => ({ isPro: true, items, collections });

describe("canCreateItem", () => {
  it("lets Free create below the limit only", () => {
    expect(canCreateItem(free(49))).toBe(true);
    expect(canCreateItem(free(50))).toBe(false);
  });

  it("lets Pro create at or over the limit", () => {
    expect(canCreateItem(pro(50))).toBe(true);
    expect(canCreateItem(pro(500))).toBe(true);
  });
});

describe("canCreateCollection", () => {
  it("lets Free create below the limit only", () => {
    expect(canCreateCollection(free(0, 2))).toBe(true);
    expect(canCreateCollection(free(0, 3))).toBe(false);
  });

  it("lets Pro create at the limit", () => {
    expect(canCreateCollection(pro(0, 3))).toBe(true);
  });
});

describe("canUploadFiles", () => {
  it("is Pro-only", () => {
    expect(canUploadFiles(free())).toBe(false);
    expect(canUploadFiles(pro())).toBe(true);
  });
});

describe("canUseAi", () => {
  it("is Pro-only", () => {
    expect(canUseAi(free())).toBe(false);
    expect(canUseAi(pro())).toBe(true);
  });
});

describe("limit messages", () => {
  // The wording lives in the `errors.limits` messages; the actions fill in FREE_LIMITS.
  const en = createTranslator({ locale: "en", messages: enMessages, namespace: "errors.limits" });
  const fr = createTranslator({ locale: "fr", messages: frMessages, namespace: "errors.limits" });

  it("names the limits from FREE_LIMITS", () => {
    expect(en("items", { max: FREE_LIMITS.items })).toBe("Free accounts can have 50 items. Upgrade to Pro in Settings.");
    expect(en("collections", { max: FREE_LIMITS.collections })).toContain("3 collections");
    expect(en("uploads")).toBe("File and image uploads are a Pro feature.");
    expect(en("ai")).toBe("AI features are a Pro feature.");
  });

  it("has them in French", () => {
    expect(fr("items", { max: FREE_LIMITS.items })).toContain("50 éléments");
    expect(fr("ai")).toBe("Les fonctionnalités d’IA sont réservées à la formule Pro.");
  });
});

describe("canShare", () => {
  it("lets Free turn on 3 public links, collections and items together", () => {
    expect(FREE_LIMITS.shared).toBe(3);
    expect(canShare({ isPro: false }, 2)).toBe(true);
    expect(canShare({ isPro: false }, 3)).toBe(false);
  });

  it("lets Pro share without a cap", () => {
    expect(canShare({ isPro: true }, 300)).toBe(true);
  });
});
