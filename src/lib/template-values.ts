/**
 * The last values typed in the variables form, per item (roadmap § B). A per-device convenience
 * in `localStorage`: one key per item, `cortex:vars:<itemId>`, and an index of the item ids,
 * newest first, so that at most `MAX_ITEMS` are kept. Every access is wrapped: storage can be
 * missing, full or blocked, and the form then simply starts empty.
 */

/** The part of the Web Storage API used here, so tests can pass a plain object. */
export interface ValueStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export const MAX_ITEMS = 50;
const PREFIX = "cortex:vars:";
const INDEX_KEY = "cortex:vars-index";

function browserStorage(): ValueStorage | null {
  try {
    return typeof window === "undefined" ? null : window.localStorage;
  } catch {
    return null;
  }
}

function readJson(storage: ValueStorage, key: string): unknown {
  const raw = storage.getItem(key);
  return raw === null ? null : JSON.parse(raw);
}

function isStringRecord(value: unknown): value is Record<string, string> {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value) &&
    Object.values(value).every((entry) => typeof entry === "string")
  );
}

/** The values saved for the item, or an empty object. */
export function loadValues(itemId: string, storage: ValueStorage | null = browserStorage()): Record<string, string> {
  if (!storage) return {};
  try {
    const values = readJson(storage, PREFIX + itemId);
    return isStringRecord(values) ? values : {};
  } catch {
    return {};
  }
}

/** Saves the item's values and moves it to the front of the index, dropping the oldest past `MAX_ITEMS`. */
export function saveValues(
  itemId: string,
  values: Record<string, string>,
  storage: ValueStorage | null = browserStorage(),
): void {
  if (!storage) return;
  try {
    const stored = readJson(storage, INDEX_KEY);
    const index = Array.isArray(stored) ? stored.filter((id): id is string => typeof id === "string") : [];
    const next = [itemId, ...index.filter((id) => id !== itemId)];
    for (const dropped of next.slice(MAX_ITEMS)) storage.removeItem(PREFIX + dropped);
    storage.setItem(PREFIX + itemId, JSON.stringify(values));
    storage.setItem(INDEX_KEY, JSON.stringify(next.slice(0, MAX_ITEMS)));
  } catch {
    // Storage full or blocked: the values are simply not remembered.
  }
}
