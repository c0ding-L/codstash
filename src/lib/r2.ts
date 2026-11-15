import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";

/**
 * Cloudflare R2 through its S3 API. The bucket stays private: files are only
 * reached through `/api/items/[id]/download`, which checks the owner.
 */

let client: S3Client | undefined;

function bucket() {
  const name = process.env.R2_BUCKET_NAME;
  if (!name) throw new Error("R2_BUCKET_NAME is not set.");
  return name;
}

/** Built on first use, so a missing variable fails the request that needs R2, not the build. */
function getClient() {
  if (client) return client;

  const { R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY } = process.env;
  if (!R2_ACCOUNT_ID || !R2_ACCESS_KEY_ID || !R2_SECRET_ACCESS_KEY) {
    throw new Error("R2 is not configured: set R2_ACCOUNT_ID, R2_ACCESS_KEY_ID and R2_SECRET_ACCESS_KEY.");
  }

  client = new S3Client({
    region: "auto",
    endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: { accessKeyId: R2_ACCESS_KEY_ID, secretAccessKey: R2_SECRET_ACCESS_KEY },
    // R2 does not support every checksum the SDK now adds by default.
    requestChecksumCalculation: "WHEN_REQUIRED",
    responseChecksumValidation: "WHEN_REQUIRED",
  });
  return client;
}

function isNotFound(error: unknown) {
  return (
    error instanceof Error &&
    (error.name === "NotFound" ||
      error.name === "NoSuchKey" ||
      ("$metadata" in error && (error.$metadata as { httpStatusCode?: number }).httpStatusCode === 404))
  );
}

export async function putObject(key: string, body: Uint8Array, contentType: string, metadata: Record<string, string>) {
  await getClient().send(
    new PutObjectCommand({ Bucket: bucket(), Key: key, Body: body, ContentType: contentType, Metadata: metadata }),
  );
}

/** The stored size and metadata, or null when there is no such object. */
export async function headObject(key: string): Promise<{ size: number; metadata: Record<string, string> } | null> {
  try {
    const head = await getClient().send(new HeadObjectCommand({ Bucket: bucket(), Key: key }));
    return { size: head.ContentLength ?? 0, metadata: head.Metadata ?? {} };
  } catch (error) {
    if (isNotFound(error)) return null;
    throw error;
  }
}

/** The object's body as a web stream, or null when there is no such object. */
export async function getObject(key: string): Promise<{ body: ReadableStream; size: number | undefined } | null> {
  try {
    const object = await getClient().send(new GetObjectCommand({ Bucket: bucket(), Key: key }));
    if (!object.Body) return null;
    return { body: object.Body.transformToWebStream(), size: object.ContentLength };
  } catch (error) {
    if (isNotFound(error)) return null;
    throw error;
  }
}

/** Deleting a key that does not exist succeeds, as in S3. */
export async function deleteObject(key: string) {
  await getClient().send(new DeleteObjectCommand({ Bucket: bucket(), Key: key }));
}

/**
 * Deletes each key, logging the ones that fail instead of throwing: it runs after
 * the item is gone from the database, so a failure leaves an orphaned object in
 * the bucket rather than an item without its file.
 */
export async function deleteObjectsQuietly(keys: string[]) {
  const results = await Promise.allSettled(keys.map((key) => deleteObject(key)));
  results.forEach((result, index) => {
    if (result.status === "rejected") console.error(`[r2] could not delete ${keys[index]}:`, result.reason);
  });
}
