import { describe, expect, it } from "vitest";

import { loadValues, MAX_ITEMS, saveValues, type ValueStorage } from "@/lib/template-values";

function memoryStorage(): ValueStorage & { data: Map<string, string> } {
  const data = new Map<string, string>();
  return {
    data,
    getItem: (key) => data.get(key) ?? null,
    setItem: (key, value) => void data.set(key, value),
    removeItem: (key) => void data.delete(key),
  };
}

describe("template values", () => {
  it("saves and loads the values of an item", () => {
    const storage = memoryStorage();
    saveValues("item-1", { container: "api" }, storage);
    expect(loadValues("item-1", storage)).toEqual({ container: "api" });
    expect(storage.data.has("cortex:vars:item-1")).toBe(true);
    expect(loadValues("item-2", storage)).toEqual({});
  });

  it(`keeps at most ${MAX_ITEMS} items and drops the oldest`, () => {
    const storage = memoryStorage();
    for (let i = 0; i <= MAX_ITEMS; i++) saveValues(`item-${i}`, { n: String(i) }, storage);
    expect(loadValues("item-0", storage)).toEqual({});
    expect(loadValues("item-1", storage)).toEqual({ n: "1" });
    expect(loadValues(`item-${MAX_ITEMS}`, storage)).toEqual({ n: String(MAX_ITEMS) });
  });

  it("moves a saved item to the front, so it is not the next one dropped", () => {
    const storage = memoryStorage();
    for (let i = 0; i < MAX_ITEMS; i++) saveValues(`item-${i}`, {}, storage);
    saveValues("item-0", { kept: "yes" }, storage);
    saveValues("new", {}, storage);
    expect(loadValues("item-0", storage)).toEqual({ kept: "yes" });
    expect(storage.data.has("cortex:vars:item-1")).toBe(false);
  });

  it("returns an empty object for broken or foreign data", () => {
    const storage = memoryStorage();
    storage.data.set("cortex:vars:a", "{not json");
    storage.data.set("cortex:vars:b", JSON.stringify({ n: 1 }));
    storage.data.set("cortex:vars:c", JSON.stringify(["x"]));
    expect(["a", "b", "c"].map((id) => loadValues(id, storage))).toEqual([{}, {}, {}]);
  });

  it("never throws when storage fails or is missing", () => {
    const failing: ValueStorage = {
      getItem: () => {
        throw new Error("blocked");
      },
      setItem: () => {
        throw new Error("full");
      },
      removeItem: () => {},
    };
    expect(loadValues("a", failing)).toEqual({});
    expect(() => saveValues("a", { x: "1" }, failing)).not.toThrow();
    expect(loadValues("a", null)).toEqual({});
    expect(() => saveValues("a", {}, null)).not.toThrow();
  });
});
