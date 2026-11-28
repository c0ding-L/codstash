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

/**
 * A request's or a response's body as bytes, refusing it as soon as more than `maxBytes` have
 * arrived: the declared length first, then the bytes as they are read, since it can be left out.
 */
export async function readBytesWithin(
  source: { headers: Headers; body: ReadableStream<Uint8Array> | null },
  maxBytes: number,
): Promise<Uint8Array | "tooLarge" | "noBody"> {
  if (Number(source.headers.get("content-length")) > maxBytes) return "tooLarge";
  if (!source.body) return "noBody";

  const reader = source.body.getReader();
  const chunks: Uint8Array[] = [];
  let received = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    received += value.byteLength;
    if (received > maxBytes) {
      await reader.cancel();
      return "tooLarge";
    }
    chunks.push(value);
  }

  const bytes = new Uint8Array(received);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return bytes;
}

export type JsonRead = { ok: true; json: unknown } | { ok: false; status: 400 | 413 };

/** Parses a JSON body within `maxBytes`, like `readFormDataWithin`. */
export async function readJsonWithin(request: Request, maxBytes: number): Promise<JsonRead> {
  const bytes = await readBytesWithin(request, maxBytes);
  if (bytes === "tooLarge") return { ok: false, status: 413 };
  if (bytes === "noBody") return { ok: false, status: 400 };
  try {
    return { ok: true, json: JSON.parse(new TextDecoder().decode(bytes)) };
  } catch {
    return { ok: false, status: 400 };
  }
}
