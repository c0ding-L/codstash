import {
  isLiteralElement,
  isPluralElement,
  isPoundElement,
  isSelectElement,
  isTagElement,
  parse,
  type MessageFormatElement,
} from "@formatjs/icu-messageformat-parser";
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

/** The ICU argument names and rich-text tags a message uses, each sorted: `{count, plural, …}` gives count. */
function signature(message: string): { args: string[]; tags: string[] } {
  const args = new Set<string>();
  const tags: string[] = [];
  const walk = (elements: MessageFormatElement[]) => {
    for (const element of elements) {
      if (isTagElement(element)) {
        tags.push(element.value);
        walk(element.children);
      } else if (isLiteralElement(element) || isPoundElement(element)) {
        continue;
      } else {
        args.add(element.value);
        if (isSelectElement(element) || isPluralElement(element)) {
          for (const option of Object.values(element.options)) walk(option.value);
        }
      }
    }
  };
  walk(parse(message));
  return { args: [...args].sort(), tags: tags.sort() };
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
      expect(signature(french.get(path) ?? "").args, path).toEqual(signature(message).args);
    }
  });

  it("use the same rich-text tags in both languages", () => {
    for (const [path, message] of english) {
      expect(signature(french.get(path) ?? "").tags, path).toEqual(signature(message).tags);
    }
  });
});
