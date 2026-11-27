import { beforeEach, describe, expect, it, vi, type Mock } from "vitest";

import { POST } from "@/app/api/import/route";
import { auth } from "@/auth";
import { setTestLocale } from "@/lib/__fixtures__/i18n-setup";
import { getPlanStatus, roomBelowLimit } from "@/lib/db/billing";
import { IMPORT_BODY_MAX_BYTES } from "@/lib/import";
import { prisma } from "@/lib/prisma";
import { checkRateLimit } from "@/lib/rate-limit";

vi.mock("@/auth", () => ({ auth: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/db/billing", () => ({ getPlanStatus: vi.fn(), roomBelowLimit: vi.fn(), assertBelowLimit: vi.fn() }));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    $transaction: vi.fn(),
    item: { findMany: vi.fn(), create: vi.fn(), count: vi.fn() },
    itemType: { findMany: vi.fn(), findFirst: vi.fn() },
    collection: { findMany: vi.fn() },
  },
}));
vi.mock("@/lib/rate-limit", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/rate-limit")>()),
  checkRateLimit: vi.fn(),
}));

const asMock = (fn: unknown) => fn as Mock;
const tx = {
  item: { createMany: vi.fn() },
  tag: { createMany: vi.fn(), findMany: vi.fn() },
  itemTag: { createMany: vi.fn() },
  itemCollection: { createMany: vi.fn() },
};
const written = () => tx.item.createMany.mock.calls.flatMap(([args]) => args.data);

function importRequest(body: unknown, init: RequestInit = {}) {
  return POST(
    new Request("http://localhost/api/import", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: typeof body === "string" ? body : JSON.stringify(body),
      ...init,
    }),
  );
}

const note = (title: string) => ({ title, type: "note", content: "Body", tags: [], collectionNames: [] });

beforeEach(() => {
  asMock(auth).mockResolvedValue({ user: { id: "user_1" } });
  asMock(getPlanStatus).mockResolvedValue({ isPro: false, items: 10, collections: 0 });
  asMock(roomBelowLimit).mockResolvedValue(40);
  asMock(checkRateLimit).mockResolvedValue({ success: true, remaining: 59, reset: Date.now() + 60_000 });
  asMock(prisma.$transaction).mockImplementation(async (fn: (t: typeof tx) => unknown) => fn(tx));
  asMock(prisma.itemType.findMany).mockImplementation(async ({ where }: { where: { slug: { in: string[] } } }) =>
    where.slug.in.map((slug) => ({ id: `t_${slug}`, slug })),
  );
  asMock(prisma.item.findMany).mockResolvedValue([]);
  asMock(prisma.item.count).mockResolvedValue(0);
  asMock(prisma.collection.findMany).mockResolvedValue([]);
  tx.item.createMany.mockReset();
  tx.item.createMany.mockResolvedValue({ count: 0 });
  tx.tag.findMany.mockResolvedValue([]);
});

describe("POST /api/import", () => {
  it("answers 401 without a session", async () => {
    asMock(auth).mockResolvedValue(null);

    const response = await importRequest({ candidates: [note("A")], conflict: "skip" });

    expect(response.status).toBe(401);
    expect(tx.item.createMany).not.toHaveBeenCalled();
  });

  it("answers 413 for a body over the cap, declared or streamed", async () => {
    const declared = await importRequest("{}", { headers: { "Content-Length": String(IMPORT_BODY_MAX_BYTES + 1) } });
    expect(declared.status).toBe(413);

    const big = JSON.stringify({ candidates: [{ ...note("A"), content: "x".repeat(IMPORT_BODY_MAX_BYTES) }], conflict: "skip" });
    const bytes = new TextEncoder().encode(big);
    const body = new ReadableStream<Uint8Array>({
      start(controller) {
        for (let i = 0; i < bytes.length; i += 65_536) controller.enqueue(bytes.subarray(i, i + 65_536));
        controller.close();
      },
    });
    const streamed = await POST(new Request("http://localhost/api/import", { method: "POST", body, duplex: "half" } as RequestInit));
    expect(streamed.status).toBe(413);
    expect(await streamed.json()).toEqual({ error: "This batch is too large to import." });
  });

  it("answers 400 for a body that is not JSON or not a batch, and for over 100 candidates", async () => {
    expect((await importRequest("not json")).status).toBe(400);
    expect((await importRequest({ candidates: [note("A")], conflict: "merge" })).status).toBe(400);
    const tooMany = await importRequest({ candidates: Array.from({ length: 101 }, (_, i) => note(`N${i}`)), conflict: "skip" });
    expect(tooMany.status).toBe(400);
    expect(tx.item.createMany).not.toHaveBeenCalled();
  });

  it("answers 429 past the limit, counted per batch", async () => {
    setTestLocale("fr");
    asMock(checkRateLimit).mockResolvedValue({ success: false, remaining: 0, reset: Date.now() + 60_000 });

    const response = await importRequest({ candidates: [note("A")], conflict: "skip" });

    expect(response.status).toBe(429);
    expect(checkRateLimit).toHaveBeenCalledWith("import", "user_1");
    expect(response.headers.get("Retry-After")).not.toBeNull();
    expect(tx.item.createMany).not.toHaveBeenCalled();
  });

  it("checks every candidate again: a javascript: link is skipped as invalid, never stored", async () => {
    const response = await importRequest({
      candidates: [{ title: "Evil", type: "link", url: "javascript:alert(document.cookie)", tags: [], collectionNames: [] }, note("Fine")],
      conflict: "duplicate",
    });

    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(await response.json()).toMatchObject({ created: 1, skipped: { invalid: 1 }, invalidTitles: ["Evil"] });
    expect(written().map((row: { title: string }) => row.title)).toEqual(["Fine"]);
    expect(JSON.stringify(tx.item.createMany.mock.calls)).not.toContain("javascript:");
  });

  it("applies the Free item limit read now, not the session's", async () => {
    asMock(roomBelowLimit).mockResolvedValue(1);

    const response = await importRequest({ candidates: [note("A"), note("B"), note("C")], conflict: "duplicate" });

    expect(getPlanStatus).toHaveBeenCalledWith("user_1");
    expect(roomBelowLimit).toHaveBeenCalledWith(tx, "user_1", "items", 50);
    expect(await response.json()).toMatchObject({ created: 1, skipped: { limit: 2 } });
  });

  it("imports without a limit for Pro", async () => {
    asMock(getPlanStatus).mockResolvedValue({ isPro: true, items: 500, collections: 40 });

    const response = await importRequest({ candidates: [note("A"), note("B")], conflict: "skip" });

    expect(await response.json()).toMatchObject({ created: 2 });
    expect(roomBelowLimit).not.toHaveBeenCalled();
  });
});
