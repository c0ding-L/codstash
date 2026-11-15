import { beforeEach, describe, expect, it, vi } from "vitest";

const send = vi.fn();

// Each command keeps its input, so a test can check what was sent to R2.
vi.mock("@aws-sdk/client-s3", () => {
  const command = (name: string) =>
    class {
      readonly name = name;
      constructor(readonly input: Record<string, unknown>) {}
    };
  return {
    S3Client: class {
      constructor(readonly config: Record<string, unknown>) {}
      send = send;
    },
    PutObjectCommand: command("put"),
    HeadObjectCommand: command("head"),
    GetObjectCommand: command("get"),
    DeleteObjectCommand: command("delete"),
  };
});

/** A fresh module, since the client is built once and cached. */
async function loadR2() {
  vi.resetModules();
  return import("@/lib/r2");
}

function notFound(name: string) {
  return Object.assign(new Error(name), { name, $metadata: { httpStatusCode: 404 } });
}

beforeEach(() => {
  vi.stubEnv("R2_ACCOUNT_ID", "account");
  vi.stubEnv("R2_ACCESS_KEY_ID", "key-id");
  vi.stubEnv("R2_SECRET_ACCESS_KEY", "secret");
  vi.stubEnv("R2_BUCKET_NAME", "bucket");
  send.mockResolvedValue({});
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("configuration", () => {
  it("fails the call, not the import, when a credential is missing", async () => {
    vi.stubEnv("R2_SECRET_ACCESS_KEY", "");
    const r2 = await loadR2();

    await expect(r2.deleteObject("k")).rejects.toThrow(/R2 is not configured/);
    expect(send).not.toHaveBeenCalled();
  });

  it("fails when the bucket is missing", async () => {
    vi.stubEnv("R2_BUCKET_NAME", "");
    const r2 = await loadR2();

    await expect(r2.deleteObject("k")).rejects.toThrow("R2_BUCKET_NAME is not set.");
  });
});

describe("putObject", () => {
  it("stores the bytes in the bucket with the type and metadata given", async () => {
    const r2 = await loadR2();
    const body = new Uint8Array([1, 2, 3]);

    await r2.putObject("u/1/a.png", body, "image/png", { kind: "image", name: "a.png" });

    expect(send.mock.calls[0]![0]).toMatchObject({
      name: "put",
      input: { Bucket: "bucket", Key: "u/1/a.png", Body: body, ContentType: "image/png", Metadata: { kind: "image", name: "a.png" } },
    });
  });
});

describe("headObject", () => {
  it("returns the size and metadata", async () => {
    send.mockResolvedValue({ ContentLength: 2048, Metadata: { kind: "file" } });
    const r2 = await loadR2();

    await expect(r2.headObject("k")).resolves.toEqual({ size: 2048, metadata: { kind: "file" } });
  });

  it.each(["NotFound", "NoSuchKey"])("is null when R2 answers %s", async (name) => {
    send.mockRejectedValue(notFound(name));
    const r2 = await loadR2();

    await expect(r2.headObject("k")).resolves.toBeNull();
  });

  it("is null on a bare 404", async () => {
    send.mockRejectedValue(Object.assign(new Error("Unknown"), { $metadata: { httpStatusCode: 404 } }));
    const r2 = await loadR2();

    await expect(r2.headObject("k")).resolves.toBeNull();
  });

  it("lets any other failure through, so it is not mistaken for a missing file", async () => {
    send.mockRejectedValue(Object.assign(new Error("AccessDenied"), { $metadata: { httpStatusCode: 403 } }));
    const r2 = await loadR2();

    await expect(r2.headObject("k")).rejects.toThrow("AccessDenied");
  });
});

describe("getObject", () => {
  it("returns the body as a web stream with its size", async () => {
    const stream = new ReadableStream();
    send.mockResolvedValue({ Body: { transformToWebStream: () => stream }, ContentLength: 8 });
    const r2 = await loadR2();

    await expect(r2.getObject("k")).resolves.toEqual({ body: stream, size: 8 });
  });

  it("is null when the object is missing or has no body", async () => {
    const r2 = await loadR2();

    send.mockRejectedValueOnce(notFound("NoSuchKey"));
    await expect(r2.getObject("k")).resolves.toBeNull();

    send.mockResolvedValueOnce({});
    await expect(r2.getObject("k")).resolves.toBeNull();
  });
});

describe("deleteObjectsQuietly", () => {
  it("deletes every key", async () => {
    const r2 = await loadR2();

    await r2.deleteObjectsQuietly(["a", "b"]);

    expect(send.mock.calls.map(([command]) => [command.name, command.input.Key])).toEqual([
      ["delete", "a"],
      ["delete", "b"],
    ]);
  });

  it("logs a failure instead of throwing, and still deletes the others", async () => {
    send.mockImplementation(async (command: { input: { Key: string } }) => {
      if (command.input.Key === "a") throw new Error("network down");
      return {};
    });
    const r2 = await loadR2();

    await expect(r2.deleteObjectsQuietly(["a", "b"])).resolves.toBeUndefined();
    expect(send).toHaveBeenCalledTimes(2);
    expect(console.error).toHaveBeenCalledWith("[r2] could not delete a:", expect.any(Error));
  });

  it("does nothing for no keys", async () => {
    const r2 = await loadR2();

    await r2.deleteObjectsQuietly([]);

    expect(send).not.toHaveBeenCalled();
  });
});
