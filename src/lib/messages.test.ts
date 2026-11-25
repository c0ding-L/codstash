import { describe, expect, it } from "vitest";

import en from "../../messages/en.json";
import fr from "../../messages/fr.json";

type Catalog = { [key: string]: string | Catalog };

/** Every leaf as `path → message`, e.g. `nav.favorites → "Favorites"`. */
function flatten(catalog: Catalog, prefix = ""): Map<string, string> {
  const entries = new Map<string, string>();
  for (const [key, value] of Object.entries(catalog)) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (typeof value === "string") entries.set(path, value);
    else for (const [childPath, message] of flatten(value, path)) entries.set(childPath, message);
  }
  return entries;
}

/** The ICU argument names a message uses: `{count, plural, …}` and `{name}` give count and name. */
function placeholders(message: string): string[] {
  const names = [...message.matchAll(/\{\s*([A-Za-z_]\w*)\s*[,}]/g)].map((match) => match[1]!);
  return [...new Set(names)].sort();
}

const english = flatten(en as Catalog);
const french = flatten(fr as Catalog);

describe("message catalogs", () => {
  it("have the same keys", () => {
    expect([...french.keys()].sort()).toEqual([...english.keys()].sort());
  });

  it("have no empty message", () => {
    for (const [path, message] of [...english, ...french]) {
      expect(message.trim(), path).not.toBe("");
    }
  });

  it("use the same placeholders in both languages", () => {
    for (const [path, message] of english) {
      expect(placeholders(french.get(path) ?? ""), path).toEqual(placeholders(message));
    }
  });
});
