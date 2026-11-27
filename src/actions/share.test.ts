import { beforeEach, describe, expect, it, vi, type Mock } from "vitest";

import { revalidatePath } from "next/cache";

import { getSharing, setSharing } from "@/actions/share";
import { auth } from "@/auth";
import { setTestLocale } from "@/lib/__fixtures__/i18n-setup";
import { getPlanStatus } from "@/lib/db/billing";
import { countShares, getShareTarget, saveShare, type ShareTarget } from "@/lib/db/share";
import { LimitReachedError } from "@/lib/usage-limits";

vi.mock("@/auth", () => ({ auth: vi.fn() }));
vi.mock("@/lib/db/billing", () => ({ getPlanStatus: vi.fn() }));
vi.mock("@/lib/db/share", () => ({ getShareTarget: vi.fn(), countShares: vi.fn(), saveShare: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

const session = auth as unknown as Mock;
const planStatus = getPlanStatus as unknown as Mock;
const target = getShareTarget as unknown as Mock;
const count = countShares as unknown as Mock;
const save = saveShare as unknown as Mock;
const revalidate = revalidatePath as unknown as Mock;

const USER = "user_1";
const SHARE_ID = "AbCdEfGhIjKlMnOpQrStUv";

/** Made-up key with the right shape, built from pieces as in `secrets.test.ts`. */
const FAKE_TOKEN = "ghp_" + "q7Rk2Lm9Vt4Bn8Zc".repeat(3);

const plan = (isPro: boolean) => ({ proUntil: null, isPro, items: 0, collections: 0 });

const textItem = (title: string, content = "Plain text") => ({ title, description: null, content, url: null });

const prompt = (overrides: Partial<ShareTarget> = {}): ShareTarget => ({
  shareId: null,
  indexable: false,
  showOwner: false,
  contentType: "text",
  scanned: [textItem("Prompt")],
  ...overrides,
});

beforeEach(() => {
  session.mockResolvedValue({ user: { id: USER } });
  planStatus.mockResolvedValue(plan(false));
  target.mockResolvedValue(prompt());
  count.mockResolvedValue(0);
  save.mockResolvedValue({ found: true, shareId: SHARE_ID });
});

describe("setSharing", () => {
  it("refuses a signed-out visitor", async () => {
    session.mockResolvedValue(null);

    expect(await setSharing({ kind: "item", id: "item_1", shared: true })).toMatchObject({
      success: false,
      error: "You are not signed in.",
    });
    expect(target).not.toHaveBeenCalled();
  });

  it("refuses an invalid kind", async () => {
    expect(await setSharing({ kind: "user" as "item", id: "x", shared: true })).toMatchObject({ success: false });
    expect(target).not.toHaveBeenCalled();
  });

  it("answers not found for another user's item, and reads with the owner", async () => {
    target.mockResolvedValue(null);

    expect(await setSharing({ kind: "item", id: "theirs", shared: true })).toEqual({
      success: false,
      data: null,
      error: "This item no longer exists.",
    });
    expect(target).toHaveBeenCalledWith(USER, "item", "theirs");
    expect(save).not.toHaveBeenCalled();
  });

  it("turns an item's link on and returns its path and usage", async () => {
    count.mockResolvedValue(1);

    const result = await setSharing({ kind: "item", id: "item_1", shared: true });

    expect(result).toEqual({
      success: true,
      error: null,
      data: {
        shareId: SHARE_ID,
        path: `/s/i/${SHARE_ID}`,
        indexable: false,
        showOwner: false,
        usage: { used: 1, max: 3 },
        hiddenCount: 0,
      },
    });
    expect(save).toHaveBeenCalledWith(
      USER,
      "item",
      "item_1",
      { shared: true, indexable: false, showOwner: false, newLink: false, currentShareId: null },
      { maxShares: 3 },
    );
    expect(revalidate).toHaveBeenCalledWith("/", "layout");
  });

  it("refuses a Free account's 4th public link, collections and items together", async () => {
    count.mockResolvedValue(3);

    expect(await setSharing({ kind: "collection", id: "col_1", shared: true })).toEqual({
      success: false,
      data: null,
      error: "Free accounts can have 3 public links. Upgrade to Pro in Settings.",
    });
    expect(save).not.toHaveBeenCalled();
  });

  it("maps a lost race under the lock to the same limit message", async () => {
    save.mockRejectedValue(new LimitReachedError("shared"));

    expect(await setSharing({ kind: "item", id: "item_1", shared: true })).toMatchObject({
      success: false,
      error: "Free accounts can have 3 public links. Upgrade to Pro in Settings.",
    });
  });

  it("lets Pro past the cap, with no limit passed down", async () => {
    planStatus.mockResolvedValue(plan(true));
    count.mockResolvedValue(40);

    const result = await setSharing({ kind: "item", id: "item_1", shared: true });

    expect(result).toMatchObject({ success: true, data: { usage: { used: 40, max: null } } });
    expect(save.mock.calls[0]![4]).toEqual({ maxShares: undefined });
  });

  it("does not count a toggle on a link that is already on", async () => {
    target.mockResolvedValue(prompt({ shareId: SHARE_ID }));
    count.mockResolvedValue(3);

    const result = await setSharing({ kind: "item", id: "item_1", shared: true, indexable: true });

    expect(result).toMatchObject({ success: true, data: { indexable: true } });
    expect(save.mock.calls[0]![3]).toMatchObject({ indexable: true, newLink: false, currentShareId: SHARE_ID });
  });

  it("asks for a new link on reset", async () => {
    target.mockResolvedValue(prompt({ shareId: SHARE_ID }));

    await setSharing({ kind: "item", id: "item_1", shared: true, resetLink: true });

    expect(save.mock.calls[0]![3]).toMatchObject({ shared: true, newLink: true });
  });

  it("turns a link off, even while the item holds a secret", async () => {
    target.mockResolvedValue(prompt({ shareId: SHARE_ID, scanned: [textItem("Keys", FAKE_TOKEN)] }));
    save.mockResolvedValue({ found: true, shareId: null });

    const result = await setSharing({ kind: "item", id: "item_1", shared: false });

    expect(result).toMatchObject({ success: true, data: { shareId: null, path: null, hiddenCount: 0 } });
    expect(save.mock.calls[0]![3]).toMatchObject({ shared: false, newLink: false });
  });

  it("refuses a file or image item", async () => {
    target.mockResolvedValue(prompt({ contentType: "file" }));

    expect(await setSharing({ kind: "item", id: "item_1", shared: true })).toMatchObject({
      success: false,
      error: "Files and images can't be shared yet.",
    });
    expect(save).not.toHaveBeenCalled();
  });

  it("refuses an item that holds a likely secret", async () => {
    target.mockResolvedValue(prompt({ scanned: [textItem("Keys", FAKE_TOKEN)] }));

    const result = await setSharing({ kind: "item", id: "item_1", shared: true });

    expect(result).toMatchObject({ success: false });
    expect(result.error).toContain("looks like it holds a secret");
    expect(save).not.toHaveBeenCalled();
  });

  it("refuses a collection with secrets, listing at most 5 titles then the rest", async () => {
    const scanned = [
      textItem("Clean"),
      ...Array.from({ length: 7 }, (_, i) => textItem(`Leak ${i + 1}`, FAKE_TOKEN)),
    ];
    target.mockResolvedValue(prompt({ scanned }));

    const result = await setSharing({ kind: "collection", id: "col_1", shared: true });

    expect(result.error).toBe(
      "Some items look like they hold a secret: “Leak 1”, “Leak 2”, “Leak 3”, “Leak 4”, “Leak 5” and 2 more. Remove the secrets before sharing.",
    );
    expect(save).not.toHaveBeenCalled();
  });

  it("refuses a toggle once a shared item has gained a secret", async () => {
    target.mockResolvedValue(prompt({ shareId: SHARE_ID, scanned: [textItem("Keys", FAKE_TOKEN)] }));

    expect(await setSharing({ kind: "item", id: "item_1", shared: true, showOwner: true })).toMatchObject({
      success: false,
    });
    expect(save).not.toHaveBeenCalled();
  });

  it("answers not found when the row vanished before the write", async () => {
    save.mockResolvedValue({ found: false, shareId: null });

    expect(await setSharing({ kind: "collection", id: "col_1", shared: true })).toMatchObject({
      success: false,
      error: "This collection no longer exists.",
    });
  });
});

describe("getSharing", () => {
  it("refuses a signed-out visitor", async () => {
    session.mockResolvedValue(null);
    expect(await getSharing({ kind: "item", id: "item_1" })).toMatchObject({ success: false });
  });

  it("counts the items a shared collection's page hides", async () => {
    target.mockResolvedValue(
      prompt({ shareId: SHARE_ID, scanned: [textItem("Clean"), textItem("Leak", FAKE_TOKEN)] }),
    );
    count.mockResolvedValue(2);

    expect(await getSharing({ kind: "collection", id: "col_1" })).toEqual({
      success: true,
      error: null,
      data: {
        shareId: SHARE_ID,
        path: `/s/${SHARE_ID}`,
        indexable: false,
        showOwner: false,
        usage: { used: 2, max: 3 },
        hiddenCount: 1,
      },
    });
  });

  it("answers not found for another user's collection", async () => {
    target.mockResolvedValue(null);
    expect(await getSharing({ kind: "collection", id: "theirs" })).toMatchObject({
      success: false,
      error: "This collection no longer exists.",
    });
  });
});

describe("setSharing in French", () => {
  it("quotes the titles with guillemets", async () => {
    setTestLocale("fr");
    target.mockResolvedValue(prompt({ scanned: [textItem("Clés", FAKE_TOKEN)] }));

    const result = await setSharing({ kind: "collection", id: "col_1", shared: true });

    expect(result.error).toContain("« Clés »");
    setTestLocale("en");
  });
});
