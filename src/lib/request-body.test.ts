import { describe, expect, it } from "vitest";

import { readFormDataWithin, readJsonWithin } from "@/lib/request-body";

const URL = "http://localhost/api/upload";

/** A multipart request whose body arrives as a stream, so it has no Content-Length. */
async function streamed(form: FormData) {
  const encoded = new Request(URL, { method: "POST", body: form });
  const bytes = new Uint8Array(await encoded.arrayBuffer());
  let sent = 0;
  const body = new ReadableStream<Uint8Array>({
    pull(controller) {
      if (sent >= bytes.length) return controller.close();
      controller.enqueue(bytes.subarray(sent, sent + 1024));
      sent += 1024;
    },
  });
  const headers = { "content-type": encoded.headers.get("content-type")! };
  return { request: new Request(URL, { method: "POST", headers, body, duplex: "half" } as RequestInit), size: bytes.length, pulled: () => sent };
}

function formWith(bytes: number) {
  const form = new FormData();
  form.set("kind", "file");
  form.set("file", new File([new Uint8Array(bytes)], "a.txt", { type: "text/plain" }));
  return form;
}

describe("readFormDataWithin", () => {
  it("parses a body under the limit", async () => {
    const result = await readFormDataWithin(new Request(URL, { method: "POST", body: formWith(100) }), 10_000);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.form.get("kind")).toBe("file");
      expect((result.form.get("file") as File).size).toBe(100);
    }
  });

  it("refuses a declared length over the limit without reading the body", async () => {
    const request = new Request(URL, { method: "POST", body: formWith(100), headers: { "content-length": "999999" } });

    await expect(readFormDataWithin(request, 10_000)).resolves.toEqual({ ok: false, status: 413 });
    expect(request.bodyUsed).toBe(false);
  });

  it("cuts off a streamed body with no Content-Length once it passes the limit", async () => {
    const { request, size, pulled } = await streamed(formWith(50_000));

    await expect(readFormDataWithin(request, 10_000)).resolves.toEqual({ ok: false, status: 413 });
    // It stopped reading near the limit rather than taking in the whole body.
    expect(pulled()).toBeLessThan(size);
  });

  it("accepts a streamed body under the limit", async () => {
    const { request } = await streamed(formWith(2_000));

    const result = await readFormDataWithin(request, 10_000);

    expect(result.ok && (result.form.get("file") as File).size).toBe(2_000);
  });

  it("refuses a body that is not multipart, or none at all", async () => {
    await expect(readFormDataWithin(new Request(URL, { method: "POST", body: "plain text" }), 10_000)).resolves.toEqual({
      ok: false,
      status: 400,
    });
    await expect(readFormDataWithin(new Request(URL, { method: "POST" }), 10_000)).resolves.toEqual({ ok: false, status: 400 });
  });
});

describe("readJsonWithin", () => {
  const post = (body: BodyInit, headers: Record<string, string> = {}) =>
    new Request(URL, { method: "POST", headers, body, duplex: "half" } as RequestInit);

  it("parses a JSON body within the cap", async () => {
    expect(await readJsonWithin(post(JSON.stringify({ a: "é" })), 100)).toEqual({ ok: true, json: { a: "é" } });
  });

  it("refuses a declared length over the cap before reading", async () => {
    expect(await readJsonWithin(post("{}", { "content-length": "101" }), 100)).toEqual({ ok: false, status: 413 });
  });

  it("refuses a streamed body once it passes the cap", async () => {
    let pulled = 0;
    const body = new ReadableStream<Uint8Array>({
      pull(controller) {
        pulled += 1;
        controller.enqueue(new Uint8Array(64));
      },
    });
    expect(await readJsonWithin(post(body), 1000)).toEqual({ ok: false, status: 413 });
    expect(pulled).toBeLessThan(20);
  });

  it("answers 400 for a body that is not JSON", async () => {
    expect(await readJsonWithin(post("nope"), 100)).toEqual({ ok: false, status: 400 });
  });
});
