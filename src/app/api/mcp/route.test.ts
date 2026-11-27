import { beforeEach, describe, expect, it, vi, type Mock } from "vitest";

import { POST } from "@/app/api/mcp/route";
import { generateToken } from "@/lib/api-token";
import { findApiTokenByHash, type ApiTokenLookup } from "@/lib/db/api-tokens";
import { mcpHandler } from "@/lib/mcp-server";
import { checkRateLimit } from "@/lib/rate-limit";

vi.mock("next/server", async (importOriginal) => ({
  ...(await importOriginal<typeof import("next/server")>()),
  after: vi.fn(),
}));
vi.mock("@/i18n/request", () => ({ default: vi.fn() }));
vi.mock("@/lib/prisma", () => ({ prisma: {} }));
vi.mock("@/lib/db/api-tokens", () => ({ findApiTokenByHash: vi.fn(), touchApiToken: vi.fn() }));
vi.mock("@/lib/rate-limit", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/rate-limit")>()),
  checkRateLimit: vi.fn(),
}));

const asMock = (fn: unknown) => fn as Mock;
const { token } = generateToken();

const tokenRow: ApiTokenLookup = {
  id: "tok1",
  userId: "user1",
  scope: "read",
  expiresAt: null,
  revokedAt: null,
  user: { proUntil: null },
};

function mcpRequest(body: unknown, authorization?: string) {
  return new Request("http://localhost/api/mcp", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      accept: "application/json, text/event-stream",
      ...(authorization && { authorization }),
    },
    body: JSON.stringify(body),
  });
}

/** The JSON-RPC message of a response, sent as JSON or as one SSE `data:` event. */
async function rpcMessage(response: Response) {
  const body = await response.text();
  if (response.headers.get("content-type")?.includes("text/event-stream")) {
    const data = body.split("\n").find((line) => line.startsWith("data:"));
    return JSON.parse(data!.slice("data:".length));
  }
  return JSON.parse(body);
}

beforeEach(() => {
  asMock(findApiTokenByHash).mockResolvedValue(tokenRow);
  asMock(checkRateLimit).mockResolvedValue({ success: true, remaining: 100, reset: Date.now() });
});

describe("POST /api/mcp", () => {
  it("answers 401 without a bearer token, before any MCP processing", async () => {
    const fetch = vi.spyOn(mcpHandler, "fetch");
    const response = await POST(mcpRequest({ jsonrpc: "2.0", id: 1, method: "tools/list" }));

    expect(response.status).toBe(401);
    expect(response.headers.get("WWW-Authenticate")).toBe("Bearer");
    expect(fetch).not.toHaveBeenCalled();
    fetch.mockRestore();
  });

  it("answers 401 for an unknown token", async () => {
    asMock(findApiTokenByHash).mockResolvedValue(null);
    const response = await POST(mcpRequest({ jsonrpc: "2.0", id: 1, method: "tools/list" }, `Bearer ${token}`));

    expect(response.status).toBe(401);
  });

  it("lists the five tools to a read token", async () => {
    const response = await POST(mcpRequest({ jsonrpc: "2.0", id: 1, method: "tools/list" }, `Bearer ${token}`));

    expect(response.status).toBe(200);
    const message = await rpcMessage(response);
    expect(message.id).toBe(1);
    expect(message.result.tools.map((tool: { name: string }) => tool.name).sort()).toEqual([
      "create_item",
      "get_collection_context",
      "get_item",
      "list_collections",
      "search_items",
    ]);
  });
});
