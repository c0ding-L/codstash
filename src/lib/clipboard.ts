import { toast } from "sonner";

/** The toasts' text, in the UI language; callers get it from the `clipboard` messages. */
export interface ClipboardMessages {
  copied: string;
  failed: string;
}

/** Copies text to the clipboard and says how it went in a toast. */
export async function copyToClipboard(text: string, messages: ClipboardMessages) {
  try {
    await navigator.clipboard.writeText(text);
    toast.success(messages.copied);
  } catch {
    toast.error(messages.failed);
  }
}

/**
 * Copies text that is still on its way, such as an item fetched on click. Safari
 * only allows a clipboard write during the click itself, not after an `await`,
 * so the write starts at once with a ClipboardItem holding the pending text, and
 * the browser waits for it. Where ClipboardItem is missing, it waits, then writes.
 */
export async function copyFromPromise(text: Promise<string>, messages: ClipboardMessages) {
  try {
    if (typeof ClipboardItem !== "undefined" && navigator.clipboard.write) {
      const blob = text.then((value) => new Blob([value], { type: "text/plain" }));
      await navigator.clipboard.write([new ClipboardItem({ "text/plain": blob })]);
    } else {
      await navigator.clipboard.writeText(await text);
    }
    toast.success(messages.copied);
  } catch {
    toast.error(messages.failed);
  }
}
