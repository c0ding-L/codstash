import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { AiStreamError, streamAi } from "@/lib/ai-stream-client";
import { CUT_OFF_MARKER, errorMarker } from "@/lib/ai-stream-protocol";

const fetchMock = vi.fn();
const encoder = new TextEncoder();

/** A 200 whose body arrives in these chunks. */
const streamed = (...chunks: string[]) =>
  new Response(
    new ReadableStream({
      start(controller) {
        for (const chunk of chunks) controller.enqueue(encoder.encode(chunk));
        controller.close();
      },
    }),
    { status: 200 },
  );

const OPTIONS = { failedMessage: "Could not explain this code. Try again." };

beforeEach(() => vi.stubGlobal("fetch", fetchMock));
afterEach(() => vi.unstubAllGlobals());

describe("streamAi", () => {
  it("posts the body as JSON and gives the whole text, ending with it in onText", async () => {
    fetchMock.mockResolvedValue(streamed("Adds ", "two ", "numbers."));
    const onText = vi.fn();

    expect(await streamAi("/api/ai/explain", { itemId: "item_1" }, { ...OPTIONS, onText })).toEqual({
      text: "Adds two numbers.",
      cutOff: false,
    });
    expect(onText).toHaveBeenLastCalledWith("Adds two numbers.");
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe("/api/ai/explain");
    expect(init).toMatchObject({ method: "POST", body: '{"itemId":"item_1"}' });
  });

  it("strips the cut-off marker and says so", async () => {
    fetchMock.mockResolvedValue(streamed("Half", CUT_OFF_MARKER));

    expect(await streamAi("/x", {}, { ...OPTIONS, onText: vi.fn() })).toEqual({ text: "Half", cutOff: true });
  });

  it("throws the message of an error marker, after showing the text that came", async () => {
    fetchMock.mockResolvedValue(streamed("Part", errorMarker("AI took too long. Try again.")));
    const onText = vi.fn();

    const error = await streamAi("/x", {}, { ...OPTIONS, onText }).catch((caught: unknown) => caught);
    expect(error).toBeInstanceOf(AiStreamError);
    expect(error).toMatchObject({ message: "AI took too long. Try again." });
    expect(onText).toHaveBeenLastCalledWith("Part");
  });

  it("throws the server's message on an error answer, or the fallback without one", async () => {
    fetchMock.mockResolvedValue(Response.json({ error: "AI features are a Pro feature." }, { status: 403 }));
    await expect(streamAi("/x", {}, { ...OPTIONS, onText: vi.fn() })).rejects.toThrow("AI features are a Pro feature.");

    fetchMock.mockResolvedValue(new Response("<html>", { status: 504 }));
    await expect(streamAi("/x", {}, { ...OPTIONS, onText: vi.fn() })).rejects.toThrow(OPTIONS.failedMessage);
  });

  it("throws the fallback on a network failure", async () => {
    fetchMock.mockRejectedValue(new TypeError("Failed to fetch"));

    await expect(streamAi("/x", {}, { ...OPTIONS, onText: vi.fn() })).rejects.toBeInstanceOf(AiStreamError);
  });

  it("rejects with the abort, not a message, when the caller stops", async () => {
    const controller = new AbortController();
    controller.abort();
    fetchMock.mockRejectedValue(new DOMException("aborted", "AbortError"));

    const error = await streamAi("/x", {}, { ...OPTIONS, onText: vi.fn(), signal: controller.signal }).catch(
      (caught: unknown) => caught,
    );
    expect(error).not.toBeInstanceOf(AiStreamError);
    expect(error).toMatchObject({ name: "AbortError" });
  });
});
