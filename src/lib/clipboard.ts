import { toast } from "sonner";

/** Copies text to the clipboard and says how it went in a toast. */
export async function copyToClipboard(text: string) {
  try {
    await navigator.clipboard.writeText(text);
    toast.success("Copied to clipboard.");
  } catch {
    toast.error("Could not copy to the clipboard.");
  }
}

/**
 * Copies text that is still on its way, such as an item fetched on click. Safari
 * only allows a clipboard write during the click itself, not after an `await`,
 * so the write starts at once with a ClipboardItem holding the pending text, and
 * the browser waits for it. Where ClipboardItem is missing, it waits, then writes.
 */
export async function copyFromPromise(text: Promise<string>) {
  try {
    if (typeof ClipboardItem !== "undefined" && navigator.clipboard.write) {
      const blob = text.then((value) => new Blob([value], { type: "text/plain" }));
      await navigator.clipboard.write([new ClipboardItem({ "text/plain": blob })]);
    } else {
      await navigator.clipboard.writeText(await text);
    }
    toast.success("Copied to clipboard.");
  } catch {
    toast.error("Could not copy to the clipboard.");
  }
}
