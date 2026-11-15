class BodyTooLarge extends Error {}

export type FormDataRead = { ok: true; form: FormData } | { ok: false; status: 400 | 413 };

/**
 * Parses a multipart body, refusing it as soon as more than `maxBytes` have
 * arrived. The declared `Content-Length` is checked first, but it can be left
 * out (a chunked request), so the bytes are also counted as they are read:
 * `request.formData()` alone would hold any amount in memory before a size
 * check could run.
 */
export async function readFormDataWithin(request: Request, maxBytes: number): Promise<FormDataRead> {
  const declared = Number(request.headers.get("content-length"));
  if (declared > maxBytes) return { ok: false, status: 413 };
  if (!request.body) return { ok: false, status: 400 };

  let received = 0;
  const counted = request.body.pipeThrough(
    new TransformStream<Uint8Array, Uint8Array>({
      transform(chunk, controller) {
        received += chunk.byteLength;
        if (received > maxBytes) controller.error(new BodyTooLarge());
        else controller.enqueue(chunk);
      },
    }),
  );

  try {
    // Same headers, so the multipart boundary is kept.
    const form = await new Request(request.url, {
      method: request.method,
      headers: request.headers,
      body: counted,
      duplex: "half",
    } as RequestInit).formData();
    return { ok: true, form };
  } catch {
    // The transform's error surfaces as a parse failure; the count says which it was.
    return { ok: false, status: received > maxBytes ? 413 : 400 };
  }
}
