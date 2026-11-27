// How the streamed AI routes (`/api/ai/explain`, `/api/ai/optimize`) end their plain-text body,
// shared by the routes and the browser. The answer's text streams as it comes; a marker on the
// last line says why it ended when it did not end normally. Pure: safe on both sides.

const MARKER_START = "\n\n[[cortex:";

/**
 * Set by the summary route when a file's text holds what looks like a secret: the browser checks a
 * note's or a prompt's text itself before calling, but never has a file's. The call still goes
 * ahead and the drawer warns, as for the other AI actions (A6).
 */
export const SECRET_WARNING_HEADER = "X-Cortex-Secret-Warning";
const MARKER_END = "]]";

/** Appended when the answer stopped early: the token cap, Explain's length cap or the route's deadline. */
export const CUT_OFF_MARKER = `${MARKER_START}cutoff${MARKER_END}`;

/** Appended when the answer failed after its text had started, with the message to show. */
export function errorMarker(message: string): string {
  // The message is ours (translated), but keep it from closing the marker early.
  return `${MARKER_START}error:${message.replaceAll(MARKER_END, "] ]")}${MARKER_END}`;
}

const TAIL_MARKER = /\n\n\[\[cortex:(cutoff|error:([^\n]*))\]\]$/;

/** A finished body: the answer's text, and how it ended. Only a marker at the very end counts. */
export function readStreamedAnswer(body: string): { text: string; cutOff: boolean; error: string | null } {
  const found = TAIL_MARKER.exec(body);
  if (!found) return { text: body, cutOff: false, error: null };
  const text = body.slice(0, found.index);
  return found[1] === "cutoff" ? { text, cutOff: true, error: null } : { text, cutOff: false, error: found[2]! };
}

/**
 * The text to show while the body still streams: without a marker that has started arriving, so
 * `[[cortex:` never flashes on screen.
 */
export function visibleStreamedText(body: string): string {
  const start = body.lastIndexOf(MARKER_START);
  if (start !== -1 && !body.slice(start + MARKER_START.length).includes("\n")) return body.slice(0, start);
  // The marker's first characters, at the very end.
  for (let length = Math.min(MARKER_START.length - 1, body.length); length > 0; length--) {
    if (MARKER_START.startsWith(body.slice(-length))) return body.slice(0, -length);
  }
  return body;
}
