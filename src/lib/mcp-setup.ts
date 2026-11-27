// The copy-ready snippets of Settings › API tokens › "Connect an AI assistant" (C3). Pure and
// client-safe; the origin comes from the server (`appOrigin`).

/** Shown where the token goes, except in the one-time view right after a token is created. */
export const MCP_TOKEN_PLACEHOLDER = "<token>";

/** The server's name in the assistant's config. */
const SERVER_NAME = "cortex";

export function mcpEndpoint(origin: string) {
  return `${origin.replace(/\/+$/, "")}/api/mcp`;
}

/** `claude mcp add …`, one line, ready for a shell. */
export function claudeCodeCommand(origin: string, token = MCP_TOKEN_PLACEHOLDER) {
  return `claude mcp add --transport http ${SERVER_NAME} ${mcpEndpoint(origin)} --header "Authorization: Bearer ${token}"`;
}

/** Cursor's `mcp.json`. */
export function cursorConfig(origin: string, token = MCP_TOKEN_PLACEHOLDER) {
  const config = {
    mcpServers: { [SERVER_NAME]: { url: mcpEndpoint(origin), headers: { Authorization: `Bearer ${token}` } } },
  };
  return JSON.stringify(config, null, 2);
}

/**
 * The app's public origin: `AUTH_URL`, else the host the page was requested on. Not `APP_URL`:
 * in development it can be a tunnel for the payment webhooks. Without a trailing slash.
 */
export function appOrigin(env: { AUTH_URL?: string }, headers: Pick<Headers, "get">) {
  const configured = env.AUTH_URL?.trim();
  if (configured) return new URL(configured).origin;
  const host = headers.get("x-forwarded-host") ?? headers.get("host") ?? "localhost:3000";
  const proto = headers.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  return `${proto.split(",")[0]!.trim()}://${host.split(",")[0]!.trim()}`;
}
