import { beforeEach, describe, expect, it, vi, type Mock } from "vitest";

import { GET } from "@/app/api/collections/[id]/context/route";
import { auth } from "@/auth";
import { setTestLocale } from "@/lib/__fixtures__/i18n-setup";
import { getCollectionContextData } from "@/lib/db/context-export";
import { checkRateLimit } from "@/lib/rate-limit";

vi.mock("@/auth", () => ({ auth: vi.fn() }));
vi.mock("@/lib/db/context-export", () => ({ getCollectionContextData: vi.fn() }));
vi.mock("@/lib/rate-limit", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/rate-limit")>()),
  checkRateLimit: vi.fn(),
}));

const asMock = (fn: unknown) => fn as Mock;

function contextRequest(id = "col_1") {
  return GET(new Request(`http://localhost/api/collections/${id}/context`), { params: Promise.resolve({ id }) });
}

beforeEach(() => {
  asMock(auth).mockResolvedValue({ user: { id: "user_1" } });
  asMock(checkRateLimit).mockResolvedValue({ success: true, remaining: 29, reset: Date.now() + 60_000 });
  asMock(getCollectionContextData).mockResolvedValue({
    collection: { name: "React", description: "Next 16 and strict TS." },
    items: [
      {
        id: "item_1",
        title: "Install",
        description: null,
        content: "npm i",
        url: null,
        language: null,
        fileName: null,
        fileSize: null,
        updatedAt: new Date("2026-11-26T10:00:00.000Z"),
        type: { slug: "command", name: "Command", isSystem: true },
      },
    ],
  });
});

describe("GET /api/collections/[id]/context", () => {
  it("answers 401 without a session", async () => {
    asMock(auth).mockResolvedValue(null);

    const response = await contextRequest();

    expect(response.status).toBe(401);
    expect(checkRateLimit).not.toHaveBeenCalled();
    expect(getCollectionContextData).not.toHaveBeenCalled();
  });

  it("answers 404 for a collection that is missing or someone else's", async () => {
    setTestLocale("fr");
    asMock(getCollectionContextData).mockResolvedValue(null);

    const response = await contextRequest("col_other");

    expect(response.status).toBe(404);
    expect(getCollectionContextData).toHaveBeenCalledWith("user_1", "col_other");
    expect(await response.json()).toEqual({ error: "Cette collection n’existe plus." });
  });

  it("answers 429 past the limit, before reading the collection", async () => {
    asMock(checkRateLimit).mockResolvedValue({ success: false, remaining: 0, reset: Date.now() + 60_000 });

    const response = await contextRequest();

    expect(response.status).toBe(429);
    expect(checkRateLimit).toHaveBeenCalledWith("contextExport", "user_1");
    expect(response.headers.get("Retry-After")).not.toBeNull();
    expect(getCollectionContextData).not.toHaveBeenCalled();
  });

  it("sends the Markdown file as an attachment", async () => {
    const response = await contextRequest();

    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toBe("text/markdown; charset=utf-8");
    expect(response.headers.get("Content-Disposition")).toBe(
      "attachment; filename=\"React-context.md\"; filename*=UTF-8''React-context.md",
    );
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(response.headers.get("X-Content-Type-Options")).toBe("nosniff");
    const text = await response.text();
    expect(text).toMatch(/^# React\n\nNext 16 and strict TS\.\n\n_Exported from Cortex on \d{4}-\d{2}-\d{2}\. 1 item\._\n/);
    expect(text).toContain("## Commands\n\n### Install\n\n```bash\nnpm i\n```\n");
  });

  it("serves a collection whose name is not ASCII", async () => {
    asMock(getCollectionContextData).mockResolvedValue({ collection: { name: "Réglages 🚀", description: null }, items: [] });

    const response = await contextRequest();

    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Disposition")).toContain("filename*=UTF-8''R%C3%A9glages%20%F0%9F%9A%80-context.md");
  });
});
