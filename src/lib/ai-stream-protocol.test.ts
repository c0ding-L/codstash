import { describe, expect, it } from "vitest";

import { CUT_OFF_MARKER, errorMarker, readStreamedAnswer, visibleStreamedText } from "@/lib/ai-stream-protocol";

describe("readStreamedAnswer", () => {
  it("reads a body with no marker as a whole answer", () => {
    expect(readStreamedAnswer("All of it.")).toEqual({ text: "All of it.", cutOff: false, error: null });
  });

  it("reads and strips the cut-off marker", () => {
    expect(readStreamedAnswer(`Half of${CUT_OFF_MARKER}`)).toEqual({ text: "Half of", cutOff: true, error: null });
  });

  it("reads and strips the error marker with its message", () => {
    expect(readStreamedAnswer(`Part${errorMarker("AI took too long. Try again.")}`)).toEqual({
      text: "Part",
      cutOff: false,
      error: "AI took too long. Try again.",
    });
  });

  it("only counts a marker at the very end", () => {
    const body = `Quoting ${CUT_OFF_MARKER} mid-answer, then more.`;
    expect(readStreamedAnswer(body)).toEqual({ text: body, cutOff: false, error: null });
  });

  it("keeps a message from closing its marker early", () => {
    expect(readStreamedAnswer(`x${errorMarker("a]]b")}`).error).toBe("a] ]b");
  });
});

describe("visibleStreamedText", () => {
  it("hides a marker as it arrives", () => {
    expect(visibleStreamedText("Text\n\n[[cor")).toBe("Text");
    expect(visibleStreamedText("Text\n\n[[cortex:err")).toBe("Text");
    expect(visibleStreamedText(`Text${CUT_OFF_MARKER}`)).toBe("Text");
  });

  it("leaves ordinary text alone", () => {
    expect(visibleStreamedText("A [[wiki]] link.")).toBe("A [[wiki]] link.");
    expect(visibleStreamedText("Line one\n\nLine two")).toBe("Line one\n\nLine two");
  });
});
