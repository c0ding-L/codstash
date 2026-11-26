import { makeZip } from "client-zip";
import { NextResponse } from "next/server";

import { auth } from "@/auth";
import { getErrors } from "@/i18n/errors-server";
import { getPlanStatus } from "@/lib/db/billing";
import { exportItemPages, getExportHeaderData } from "@/lib/db/export";
import { exportFileName, exportHeader, exportJsonChunks, isExportFormat } from "@/lib/export";
import { zipEntries } from "@/lib/export-zip";
import { getObject } from "@/lib/r2";
import { checkRateLimit, tooManyAttemptsResponse } from "@/lib/rate-limit";
import { canExport } from "@/lib/usage-limits";

/** A large stash with many stored files takes a while; Fluid compute allows up to 300 s on this project. */
export const maxDuration = 300;

/**
 * Logs a failure while the body streams (a database or storage error after the 200 went
 * out), then rethrows it so the response ends in error: the download fails instead of
 * looking complete.
 */
async function* logged<T>(entries: AsyncIterable<T>, userId: string, format: string): AsyncGenerator<T> {
  try {
    yield* entries;
  } catch (error) {
    console.error(`[export] ${format} export failed mid-stream for user ${userId}:`, error);
    throw error;
  }
}

/** Encodes the strings of an async iterator as a byte stream, pulled as the response is read. */
function textStream(chunks: AsyncIterator<string>): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  return new ReadableStream({
    async pull(controller) {
      try {
        const { done, value } = await chunks.next();
        if (done) controller.close();
        else controller.enqueue(encoder.encode(value));
      } catch (error) {
        controller.error(error);
      }
    },
    async cancel() {
      await chunks.return?.(undefined);
    },
  });
}

/**
 * All of the signed-in user's data, as one JSON document or a ZIP that also holds a
 * readable copy of each text item and the stored files. Streamed as it is read, never
 * held whole in memory. Outside the proxy's matcher, so the session is checked here.
 */
export async function GET(request: Request) {
  const e = await getErrors();
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: e.message("notSignedIn") }, { status: 401 });
  }
  const userId = session.user.id;

  const format = new URL(request.url).searchParams.get("format");
  if (!isExportFormat(format)) {
    return NextResponse.json({ error: e.message("export.badFormat") }, { status: 400 });
  }

  // Pro first, so a Free user spends no limiter slot.
  if (!canExport(await getPlanStatus(userId))) {
    return NextResponse.json({ error: e.message("limits.export") }, { status: 403 });
  }

  const limit = await checkRateLimit("export", userId);
  if (!limit.success) return await tooManyAttemptsResponse(limit.reset);

  // A JWT whose user row was deleted.
  const data = await getExportHeaderData(userId);
  if (!data) {
    return NextResponse.json({ error: e.message("notSignedIn") }, { status: 401 });
  }

  const now = new Date();
  const header = exportHeader({ ...data, exportedAt: now });
  const itemPages = () => exportItemPages(userId);

  const body =
    format === "json"
      ? textStream(logged(exportJsonChunks(header, itemPages()), userId, format))
      : makeZip(logged(zipEntries({ header, itemPages, getObject, now }), userId, format));

  return new Response(body, {
    headers: {
      "Content-Type": format === "json" ? "application/json; charset=utf-8" : "application/zip",
      "Content-Disposition": `attachment; filename="${exportFileName(format, now)}"`,
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
