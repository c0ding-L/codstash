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
