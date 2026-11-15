import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { toast } from "sonner";

import { copyFromPromise, copyToClipboard } from "./clipboard";

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const writeText = vi.fn<(text: string) => Promise<void>>();
const write = vi.fn<(items: FakeClipboardItem[]) => Promise<void>>();

/** Stands in for the browser's ClipboardItem: keeps what it was given. */
class FakeClipboardItem {
  constructor(public readonly items: Record<string, Promise<Blob>>) {}
}

beforeEach(() => {
  vi.stubGlobal("navigator", { clipboard: { writeText, write } });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("copyToClipboard", () => {
  it("copies the text and confirms with a success toast", async () => {
    writeText.mockResolvedValue(undefined);

    await copyToClipboard("npm test");

    expect(writeText).toHaveBeenCalledWith("npm test");
    expect(toast.success).toHaveBeenCalledWith("Copied to clipboard.");
    expect(toast.error).not.toHaveBeenCalled();
  });

  it("shows an error toast instead of throwing when the clipboard refuses", async () => {
    writeText.mockRejectedValue(new DOMException("Denied", "NotAllowedError"));

    await expect(copyToClipboard("npm test")).resolves.toBeUndefined();

    expect(toast.error).toHaveBeenCalledWith("Could not copy to the clipboard.");
    expect(toast.success).not.toHaveBeenCalled();
  });
});

describe("copyFromPromise", () => {
  it("writes a clipboard item holding the pending text, so the click still counts in Safari", async () => {
    vi.stubGlobal("ClipboardItem", FakeClipboardItem);
    write.mockImplementation(async ([item]) => {
      // The item is created before the text arrives; the browser waits on it.
      expect(await (await item!.items["text/plain"]!).text()).toBe("Review the diff");
    });

    await copyFromPromise(Promise.resolve("Review the diff"));

    expect(write).toHaveBeenCalledOnce();
    expect(writeText).not.toHaveBeenCalled();
    expect(toast.success).toHaveBeenCalledWith("Copied to clipboard.");
  });

  it("waits for the text and writes it plainly where ClipboardItem is missing", async () => {
    writeText.mockResolvedValue(undefined);

    await copyFromPromise(Promise.resolve("Review the diff"));

    expect(writeText).toHaveBeenCalledWith("Review the diff");
    expect(toast.success).toHaveBeenCalledWith("Copied to clipboard.");
  });

  it("shows an error toast instead of throwing when the text cannot be loaded", async () => {
    vi.stubGlobal("ClipboardItem", FakeClipboardItem);
    write.mockImplementation(async ([item]) => {
      await item!.items["text/plain"];
    });

    await expect(copyFromPromise(Promise.reject(new Error("404")))).resolves.toBeUndefined();

    expect(toast.error).toHaveBeenCalledWith("Could not copy to the clipboard.");
    expect(toast.success).not.toHaveBeenCalled();
  });
});
