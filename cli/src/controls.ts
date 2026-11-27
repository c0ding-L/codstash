/**
 * Control characters that change what a terminal shows: C0 and C1 controls (ESC sequences, `\r`,
 * `\b`, BEL…) and the bidirectional overrides that reorder text. A stored command holding one can
 * look different from what runs, so `run` shows them escaped and refuses to run the command.
 * Newlines and tabs are fine.
 */
const CONTROL = /[\x00-\x08\x0b-\x1f\x7f-\x9f؜‎‏‪-‮⁦-⁩]/g;

/** `\r\n` as `\n`: line endings from Windows are not a trick. */
export function normalizeNewlines(text: string) {
  return text.replace(/\r\n/g, "\n");
}

export function hasControlChars(text: string) {
  CONTROL.lastIndex = 0;
  return CONTROL.test(text);
}

/** The text with each control character written out, e.g. `\x1b` or `‮`. */
export function showControlChars(text: string) {
  return text.replace(CONTROL, (char) => {
    const code = char.charCodeAt(0);
    return code <= 0xff ? `\\x${code.toString(16).padStart(2, "0")}` : `\\u${code.toString(16).padStart(4, "0")}`;
  });
}
