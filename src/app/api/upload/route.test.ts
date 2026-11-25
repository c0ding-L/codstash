import { beforeEach, describe, expect, it, vi, type Mock } from "vitest";

import { POST } from "@/app/api/upload/route";
import { auth } from "@/auth";
import { setTestLocale } from "@/lib/__fixtures__/i18n-setup";
import { getPlanStatus } from "@/lib/db/billing";
import { putObject } from "@/lib/r2";
import { checkRateLimit } from "@/lib/rate-limit";

vi.mock("@/auth", () => ({ auth: vi.fn() }));
vi.mock("@/lib/db/billing", () => ({ getPlanStatus: vi.fn() }));
vi.mock("@/lib/r2", () => ({ putObject: vi.fn() }));
vi.mock("@/lib/rate-limit", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/rate-limit")>()),
  checkRateLimit: vi.fn(),
}));

const asMock = (fn: unknown) => fn as Mock;
const MB = 1024 * 1024;

function upload(kind: string, file: File) {
  const form = new FormData();
  form.set("kind", kind);
  form.set("file", file);
  return POST(new Request("http://localhost/api/upload", { method: "POST", body: form }));
}

beforeEach(() => {
  asMock(auth).mockResolvedValue({ user: { id: "user_1" } });
  asMock(checkRateLimit).mockResolvedValue({ success: true, remaining: 9, reset: Date.now() + 60_000 });
  asMock(getPlanStatus).mockResolvedValue({ isPro: true });
  asMock(putObject).mockResolvedValue(undefined);
});

describe("POST /api/upload in French", () => {
  beforeEach(() => setTestLocale("fr"));

  it("says the user is not signed in", async () => {
    asMock(auth).mockResolvedValue(null);

    const response = await upload("image", new File(["x"], "a.png", { type: "image/png" }));

    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ error: "Vous n’êtes pas connecté." });
  });

  it("refuses uploads on the Free plan", async () => {
    asMock(getPlanStatus).mockResolvedValue({ isPro: false });

    const response = await upload("image", new File(["x"], "a.png", { type: "image/png" }));

    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({ error: "L’import de fichiers et d’images est réservé à la formule Pro." });
  });

  it("words a too-large image with its limit in megabytes", async () => {
    const response = await upload("image", new File([new Uint8Array(5 * MB + 1)], "a.png", { type: "image/png" }));

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "Les images ne peuvent pas dépasser 5 Mo." });
    expect(putObject).not.toHaveBeenCalled();
  });

  it("lists the allowed extensions", async () => {
    const response = await upload("image", new File(["x"], "a.exe", { type: "" }));

    const { error } = await response.json();
    expect(error).toMatch(/^Les images doivent avoir l’une des extensions suivantes\u00a0: \.png, /u);
  });
});
