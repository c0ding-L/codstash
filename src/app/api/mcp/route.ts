import { authenticateApi } from "@/lib/api-auth";
import { authInfoFor, mcpHandler } from "@/lib/mcp-server";

// A collection's context can take a while to read and render.
export const maxDuration = 60;

/**
 * The MCP server (C3): Streamable HTTP, stateless. The bearer token is checked, and counted
 * against the `api` rate limit, before any MCP processing; write tools check the write scope,
 * Pro and `apiWrite` themselves, so a read token still sees every tool.
 */
async function handle(request: Request) {
  const caller = await authenticateApi(request, "read");
  if (caller instanceof Response) return caller;
  return mcpHandler.fetch(request, { authInfo: authInfoFor(caller) });
}

export { handle as DELETE, handle as GET, handle as POST };
