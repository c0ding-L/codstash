import { beforeEach, describe, expect, it, vi, type Mock } from "vitest";

import { GET } from "@/app/api/export/route";
import { auth } from "@/auth";
import { setTestLocale } from "@/lib/__fixtures__/i18n-setup";
import { getPlanStatus } from "@/lib/db/billing";
import { exportItemPages, getExportHeaderData } from "@/lib/db/export";
import { getObject } from "@/lib/r2";
import { checkRateLimit } from "@/lib/rate-limit";

vi.mock("@/auth", () => ({ auth: vi.fn() }));
vi.mock("@/lib/db/billing", () => ({ getPlanStatus: vi.fn() }));
vi.mock("@/lib/db/export", () => ({ getExportHeaderData: vi.fn(), exportItemPages: vi.fn() }));
vi.mock("@/lib/r2", () => ({ getObject: vi.fn() }));
vi.mock("@/lib/rate-limit", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/rate-limit")>()),
  checkRateLimit: vi.fn(),
}));

const asMock = (fn: unknown) => fn as Mock;
const NOW = new Date("2026-11-26T10:00:00.000Z");

function exportRequest(format: string | null) {
  const url = new URL("http://localhost/api/export");
  if (format !== null) url.searchParams.set("format", format);
  return GET(new Request(url));
}

function item(id: string, overrides: Record<string, unknown> = {}) {
  return {
    id,
    title: `Item ${id}`,
    description: null,
    contentType: "text",
    content: "echo hi",
    url: null,
    language: "shell",
    isFavorite: false,
    isPinned: false,
    fileName: null,
    fileSize: null,
    fileUrl: null,
    createdAt: NOW,
    updatedAt: NOW,
    type: { slug: "command", isSystem: true },
    tags: ["shell"],
    collectionIds: [],
    ...overrides,
  };
}

beforeEach(() => {
  asMock(auth).mockResolvedValue({ user: { id: "user_1" } });
  asMock(getPlanStatus).mockResolvedValue({ isPro: true });
  asMock(checkRateLimit).mockResolvedValue({ success: true, remaining: 4, reset: Date.now() + 60_000 });
  asMock(getExportHeaderData).mockResolvedValue({
    user: { name: "Demo", email: "demo@example.com", locale: "en" },
    types: [],
    collections: [],
  });
  asMock(exportItemPages).mockImplementation(async function* () {
    yield [
      item("cmh0000000000000aaaaaaaa"),
      item("cmh0000000000000bbbbbbbb", {
        contentType: "file",
        fileName: "a.png",
        fileUrl: "users/user_1/a.png",
        type: { slug: "image", isSystem: true },
      }),
    ];
  });
});

describe("GET /api/export", () => {
  it("answers 401 without a session", async () => {
    asMock(auth).mockResolvedValue(null);

    const response = await exportRequest("json");

    expect(response.status).toBe(401);
    expect(getExportHeaderData).not.toHaveBeenCalled();
  });

  it("answers 400 for a missing or unknown format", async () => {
    expect((await exportRequest(null)).status).toBe(400);
    const response = await exportRequest("csv");
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "Choose JSON or ZIP for the export." });
  });

  it("refuses the Free plan before spending a rate-limit slot", async () => {
    setTestLocale("fr");
    asMock(getPlanStatus).mockResolvedValue({ isPro: false });

    const response = await exportRequest("zip");

    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({ error: "L’exportation de vos données est réservée à la formule Pro." });
    expect(checkRateLimit).not.toHaveBeenCalled();
  });

  it("answers 429 past the limit", async () => {
    asMock(checkRateLimit).mockResolvedValue({ success: false, remaining: 0, reset: Date.now() + 60_000 });

    const response = await exportRequest("json");

    expect(response.status).toBe(429);
    expect(checkRateLimit).toHaveBeenCalledWith("export", "user_1");
    expect(response.headers.get("Retry-After")).not.toBeNull();
  });

  it("streams the JSON document as an attachment", async () => {
    const response = await exportRequest("json");

    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toBe("application/json; charset=utf-8");
    expect(response.headers.get("Content-Disposition")).toMatch(/^attachment; filename="cortex-export-\d{4}-\d{2}-\d{2}\.json"; filename\*=UTF-8''cortex-export-/);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    const document = await response.json();
    expect(document).toMatchObject({ format: "cortex-export", version: 1 });
    expect(document.items).toHaveLength(2);
    expect(JSON.stringify(document)).not.toContain("users/user_1/a.png");
    expect(exportItemPages).toHaveBeenCalledWith("user_1");
  });

  it("streams a ZIP holding the data, the items and the stored files", async () => {
    asMock(getObject).mockResolvedValue({ body: new Blob(["PNGDATA"]).stream(), size: 7 });

    const response = await exportRequest("zip");

    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toBe("application/zip");
    const bytes = new Uint8Array(await response.arrayBuffer());
    // A ZIP starts with a local file header.
    expect(Array.from(bytes.slice(0, 4))).toEqual([0x50, 0x4b, 0x03, 0x04]);
    const text = new TextDecoder("latin1").decode(bytes);
    expect(text).toContain("data.json");
    expect(text).toContain("items/commands/Item cmh0000000000000aaaaaaaa-aaaaaaaa.sh");
    expect(text).toContain("files/bbbbbbbb-a.png");
    expect(text).toContain("PNGDATA");
    expect(getObject).toHaveBeenCalledWith("users/user_1/a.png");
  });

  it("still answers when a stored file is missing", async () => {
    asMock(getObject).mockResolvedValue(null);

    const response = await exportRequest("zip");
    const text = new TextDecoder("latin1").decode(await response.arrayBuffer());

    expect(response.status).toBe(200);
    expect(text).toContain("missing-files.txt");
    expect(text).toContain("data.json");
  });
});

describe("GET /api/export when the database fails mid-stream", () => {
  it("logs the failure and ends the body in error", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    asMock(exportItemPages).mockImplementation(async function* () {
      yield [item("cmh0000000000000aaaaaaaa")];
      throw new Error("connection lost");
    });

    const response = await exportRequest("json");

    expect(response.status).toBe(200);
    await expect(response.text()).rejects.toThrow("connection lost");
    expect(log).toHaveBeenCalledWith(expect.stringContaining("[export] json export failed mid-stream"), expect.any(Error));
  });
});
