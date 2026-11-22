import { beforeEach, describe, expect, it, vi, type Mock } from "vitest";

import { auth } from "@/auth";
import { getEditorPreferences } from "@/lib/db/profile";
import { DEFAULT_EDITOR_PREFERENCES } from "@/lib/editor-preferences";
import { loadEditorPreferences } from "@/lib/load-editor-preferences";

vi.mock("@/auth", () => ({ auth: vi.fn() }));
vi.mock("@/lib/db/profile", () => ({ getEditorPreferences: vi.fn() }));

const asMock = (fn: unknown) => fn as Mock;
const session = asMock(auth);
const readPreferences = asMock(getEditorPreferences);

const SAVED = { ...DEFAULT_EDITOR_PREFERENCES, fontSize: 16, theme: "monokai" as const };

beforeEach(() => {
  session.mockResolvedValue({ user: { id: "user_1" } });
  readPreferences.mockResolvedValue(SAVED);
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("loadEditorPreferences", () => {
  it("reads the signed-in user's preferences", async () => {
    expect(await loadEditorPreferences()).toEqual(SAVED);
    expect(readPreferences).toHaveBeenCalledWith("user_1");
  });

  it.each([null, { user: {} }])("returns the defaults without reading for session %j", async (value) => {
    session.mockResolvedValue(value);

    expect(await loadEditorPreferences()).toEqual(DEFAULT_EDITOR_PREFERENCES);
    expect(readPreferences).not.toHaveBeenCalled();
  });

  it("falls back to the defaults when the read fails", async () => {
    readPreferences.mockRejectedValue(new Error("down"));

    expect(await loadEditorPreferences()).toEqual(DEFAULT_EDITOR_PREFERENCES);
  });

  // Next.js throws from `headers()` to switch a route to dynamic rendering while prerendering.
  it("lets an error from auth() through", async () => {
    const dynamicUsage = new Error("Dynamic server usage");
    session.mockRejectedValue(dynamicUsage);

    await expect(loadEditorPreferences()).rejects.toBe(dynamicUsage);
  });
});
