import { NextResponse } from "next/server";

import { auth } from "@/auth";
import { getErrors } from "@/i18n/errors-server";
import { getPlanStatus } from "@/lib/db/billing";
import { buildFileKey, isUploadKind, toObjectMetadata, UPLOAD_RULES, validateUpload } from "@/lib/files";
import { putObject } from "@/lib/r2";
import { checkRateLimit, tooManyAttemptsResponse } from "@/lib/rate-limit";
import { readFormDataWithin } from "@/lib/request-body";
import { canUploadFiles } from "@/lib/usage-limits";

/** Room for the multipart boundaries and the other fields on top of the largest file. */
const MAX_BODY_BYTES = UPLOAD_RULES.file.maxBytes + 64 * 1024;

/**
 * Stores one file or image in R2 and returns its key, which the New Item dialog
 * then passes to `createItem`. A route rather than a server action: actions cap
 * the body at 1 MB, and the dialog needs upload progress, which only XHR gives.
 * Outside the proxy's matcher, so the session is checked here.
 */
export async function POST(request: Request) {
  const e = await getErrors();
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: e.message("notSignedIn") }, { status: 401 });
  }

  // Before the body is read, so a refused upload costs nothing.
  const limit = await checkRateLimit("upload", session.user.id);
  if (!limit.success) return await tooManyAttemptsResponse(limit.reset);

  // Uploads are Pro-only; also before the body is read.
  if (!canUploadFiles(await getPlanStatus(session.user.id))) {
    return NextResponse.json({ error: e.message("limits.uploads") }, { status: 403 });
  }

  // Counted as it arrives, so a body with no or a false Content-Length is cut off too.
  const body = await readFormDataWithin(request, MAX_BODY_BYTES);
  if (!body.ok) {
    return body.status === 413
      ? NextResponse.json({ error: e.message("upload.tooLarge") }, { status: 413 })
      : NextResponse.json({ error: e.message("upload.notMultipart") }, { status: 400 });
  }
  const { form } = body;

  const kind = form.get("kind");
  const file = form.get("file");
  if (!isUploadKind(kind) || !(file instanceof File)) {
    return NextResponse.json({ error: e.message("items.chooseFile") }, { status: 400 });
  }

  // The same checks the browser ran, run for real: size from the bytes received.
  const check = validateUpload(kind, file);
  if (!check.ok) {
    return NextResponse.json({ error: e.message(`upload.${check.error.key}`, check.error.values) }, { status: 400 });
  }

  const key = buildFileKey(session.user.id, file.name);
  try {
    await putObject(key, new Uint8Array(await file.arrayBuffer()), check.contentType, toObjectMetadata(kind, file.name));
  } catch (error) {
    console.error("[upload] could not store the file:", error);
    return NextResponse.json({ error: e.message("upload.failed") }, { status: 502 });
  }

  return NextResponse.json({ key }, { status: 201 });
}
