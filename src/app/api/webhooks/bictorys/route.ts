import { NextResponse } from "next/server";

import { handleBictorysWebhook } from "@/lib/billing-webhook";

/**
 * Bictorys payment webhooks. Outside the proxy's matcher, so it is public and
 * authenticated by the shared `X-Secret-Key` instead of a session. The body is
 * read as raw text for the optional HMAC check.
 */
export async function POST(request: Request) {
  const rawBody = await request.text();
  try {
    const { status } = await handleBictorysWebhook(request.headers, rawBody);
    return new NextResponse(null, { status });
  } catch (error) {
    // 500 makes Bictorys retry the event.
    console.error("[billing] webhook failed:", error);
    return new NextResponse(null, { status: 500 });
  }
}
