import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { toast } from "sonner";

import { copyToClipboard } from "./clipboard";

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const writeText = vi.fn<(text: string) => Promise<void>>();

beforeEach(() => {
  vi.stubGlobal("navigator", { clipboard: { writeText } });
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
