import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { uploadFile } from "@/lib/upload-client";

/** The parts of XMLHttpRequest that `uploadFile` touches; the test drives its events. */
class FakeRequest {
  static last: FakeRequest;
  method = "";
  url = "";
  responseType = "";
  status = 0;
  response: unknown = null;
  sent: FormData | null = null;
  upload: { onprogress: ((event: { lengthComputable: boolean; loaded: number; total: number }) => void) | null } = {
    onprogress: null,
  };
  onload: (() => void) | null = null;
  onerror: (() => void) | null = null;

  constructor() {
    FakeRequest.last = this;
  }
  open(method: string, url: string) {
    this.method = method;
    this.url = url;
  }
  send(body: FormData) {
    this.sent = body;
  }
  respond(status: number, response: unknown) {
    this.status = status;
    this.response = response;
    this.onload?.();
  }
}

const file = new File(["hello"], "notes.md", { type: "text/markdown" });

beforeEach(() => {
  vi.stubGlobal("XMLHttpRequest", FakeRequest);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

const MESSAGES = {
  failed: "Could not upload the file. Try again.",
  network: "The upload failed. Check your connection and try again.",
};

describe("uploadFile", () => {
  it("posts the kind and the file as form data to the upload route", () => {
    void uploadFile("file", file, () => {}, MESSAGES);
    const request = FakeRequest.last;

    expect([request.method, request.url, request.responseType]).toEqual(["POST", "/api/upload", "json"]);
    expect(request.sent?.get("kind")).toBe("file");
    expect((request.sent?.get("file") as File).name).toBe("notes.md");
  });

  it("reports progress as a fraction, ignoring events without a total", () => {
    const onProgress = vi.fn();
    void uploadFile("file", file, onProgress, MESSAGES);
    const { upload } = FakeRequest.last;

    upload.onprogress?.({ lengthComputable: false, loaded: 10, total: 0 });
    upload.onprogress?.({ lengthComputable: true, loaded: 25, total: 100 });

    expect(onProgress.mock.calls).toEqual([[0.25]]);
  });

  it("resolves with the key and reports completion", async () => {
    const onProgress = vi.fn();
    const pending = uploadFile("image", file, onProgress, MESSAGES);

    FakeRequest.last.respond(201, { key: "u/1/notes.md" });

    await expect(pending).resolves.toBe("u/1/notes.md");
    expect(onProgress).toHaveBeenLastCalledWith(1);
  });

  it("rejects with the server's message", async () => {
    const pending = uploadFile("file", file, () => {}, MESSAGES);

    FakeRequest.last.respond(400, { error: "Files can be at most 10 MB." });

    await expect(pending).rejects.toThrow("Files can be at most 10 MB.");
  });

  it("rejects with a generic message when the server gives none", async () => {
    const pending = uploadFile("file", file, () => {}, MESSAGES);

    FakeRequest.last.respond(502, null);

    await expect(pending).rejects.toThrow("Could not upload the file. Try again.");
  });

  it("does not accept a success without a key", async () => {
    const pending = uploadFile("file", file, () => {}, MESSAGES);

    FakeRequest.last.respond(201, {});

    await expect(pending).rejects.toThrow("Could not upload the file. Try again.");
  });

  it("rejects on a network failure", async () => {
    const pending = uploadFile("file", file, () => {}, MESSAGES);

    FakeRequest.last.onerror?.();

    await expect(pending).rejects.toThrow("The upload failed. Check your connection and try again.");
  });
});
