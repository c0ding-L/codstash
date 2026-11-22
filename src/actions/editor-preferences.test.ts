import { beforeEach, describe, expect, it, vi, type Mock } from "vitest";

import { updateEditorPreferences } from "@/actions/editor-preferences";
import { auth } from "@/auth";
import { DEFAULT_EDITOR_PREFERENCES, type EditorPreferences } from "@/lib/editor-preferences";
import { prisma } from "@/lib/prisma";

vi.mock("@/auth", () => ({ auth: vi.fn() }));
vi.mock("@/lib/prisma", () => ({ prisma: { user: { update: vi.fn() } } }));

const asMock = (fn: unknown) => fn as Mock;
const session = asMock(auth);
const updateUser = asMock(prisma.user.update);

const CHANGED: EditorPreferences = { fontSize: 16, tabSize: 4, wordWrap: false, minimap: true, theme: "monokai" };

beforeEach(() => {
  session.mockResolvedValue({ user: { id: "user_1" } });
  updateUser.mockResolvedValue({});
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("updateEditorPreferences", () => {
  it("saves the preferences on the signed-in user's row", async () => {
    expect(await updateEditorPreferences(CHANGED)).toEqual({ success: true, error: null });
    expect(updateUser).toHaveBeenCalledWith({ where: { id: "user_1" }, data: { editorPreferences: CHANGED } });
  });

  it("stores only the known fields", async () => {
    await updateEditorPreferences({ ...CHANGED, extra: "x" } as EditorPreferences);

    expect(updateUser.mock.calls[0]![0].data.editorPreferences).toEqual(CHANGED);
  });

  it.each([
    { fontSize: 99 },
    { tabSize: 3 },
    { theme: "solarized" },
    { wordWrap: "on" },
  ])("rejects %j before reading the session", async (change) => {
    const result = await updateEditorPreferences({ ...DEFAULT_EDITOR_PREFERENCES, ...change } as EditorPreferences);

    expect(result).toEqual({ success: false, error: "Invalid editor preferences." });
    expect(session).not.toHaveBeenCalled();
    expect(updateUser).not.toHaveBeenCalled();
  });

  it("refuses without a session", async () => {
    session.mockResolvedValue(null);

    expect(await updateEditorPreferences(CHANGED)).toEqual({ success: false, error: "You are not signed in." });
    expect(updateUser).not.toHaveBeenCalled();
  });

  it("reports a database failure", async () => {
    updateUser.mockRejectedValue(new Error("down"));

    expect(await updateEditorPreferences(CHANGED)).toEqual({
      success: false,
      error: "Could not save your editor preferences. Try again.",
    });
  });
});
