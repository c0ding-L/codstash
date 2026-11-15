import { NextResponse } from "next/server";

import { auth } from "@/auth";
import { getItemFile } from "@/lib/db/items";
import { attachmentDisposition, contentTypeFor } from "@/lib/files";
import { getObject } from "@/lib/r2";

/**
 * Streams an item's file from the private bucket, for its owner only. Served
 * from the app's origin, so it never runs as a page: always an attachment, no
 * MIME sniffing, and a sandbox in case a browser renders it anyway (an SVG can
 * carry scripts). An `<img>` still shows images, which the drawer uses.
 */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }

  const file = await getItemFile(session.user.id, (await params).id);
  if (!file) {
    return NextResponse.json({ error: "File not found." }, { status: 404 });
  }

  const object = await getObject(file.fileUrl);
  if (!object) {
    return NextResponse.json({ error: "File not found." }, { status: 404 });
  }

  const headers = new Headers({
    "Content-Type": contentTypeFor(file.fileName),
    "Content-Disposition": attachmentDisposition(file.fileName),
    "X-Content-Type-Options": "nosniff",
    "Content-Security-Policy": "default-src 'none'; style-src 'unsafe-inline'; sandbox",
    // The bytes behind a key never change, but they are private.
    "Cache-Control": "private, max-age=3600",
  });
  if (object.size !== undefined) headers.set("Content-Length", String(object.size));

  return new Response(object.body, { headers });
}
