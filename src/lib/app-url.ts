/**
 * The app's public URL for links sent out of the app (emails, payment returns), without a
 * trailing slash, or null with a logged error when `APP_URL` is not set. Server-only. The MCP
 * setup page reads `AUTH_URL` instead, on purpose (see `src/lib/mcp-setup.ts`).
 */
export function appBaseUrl(logTag: string): string | null {
  const baseUrl = process.env.APP_URL?.replace(/\/+$/, "");
  if (!baseUrl) {
    console.error(`[${logTag}] APP_URL is not set.`);
    return null;
  }
  return baseUrl;
}
