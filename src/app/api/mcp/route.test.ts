import { beforeEach, describe, expect, it, vi, type Mock } from "vitest";

import { POST } from "@/app/api/mcp/route";
import { generateToken } from "@/lib/api-token";
import { findMcpPromptRows, listMcpPromptRows } from "@/lib/db/api-items";
import { findApiTokenByHash, type ApiTokenLookup } from "@/lib/db/api-tokens";
import { mcpHandler } from "@/lib/mcp-server";
import { checkRateLimit } from "@/lib/rate-limit";

vi.mock("next/server", async (importOriginal) => ({
  ...(await importOriginal<typeof import("next/server")>()),
  after: vi.fn(),
}));
vi.mock("@/i18n/request", () => ({ default: vi.fn() }));
vi.mock("@/lib/prisma", () => ({ prisma: {} }));
vi.mock("@/lib/db/api-items", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/db/api-items")>()),
  listMcpPromptRows: vi.fn(),
  findMcpPromptRows: vi.fn(),
}));
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

const prompt = { id: "cm0prompt000000000ab12cd34", title: "Explain code", description: null, content: "Explain {{code}} in {{tone:plain}} words." };
const call = (body: unknown) => POST(mcpRequest({ jsonrpc: "2.0", id: 1, ...(body as object) }, `Bearer ${token}`));

beforeEach(() => {
  asMock(findApiTokenByHash).mockResolvedValue(tokenRow);
  asMock(checkRateLimit).mockResolvedValue({ success: true, remaining: 100, reset: Date.now() });
  asMock(listMcpPromptRows).mockResolvedValue([prompt]);
  asMock(findMcpPromptRows).mockResolvedValue([prompt]);
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

  it("reads no prompts for a tool request", async () => {
    await call({ method: "tools/list" });
    expect(listMcpPromptRows).not.toHaveBeenCalled();
    expect(findMcpPromptRows).not.toHaveBeenCalled();
  });

  it("lists the caller's prompts with their variables as arguments", async () => {
    const message = await rpcMessage(await call({ method: "prompts/list" }));

    expect(listMcpPromptRows).toHaveBeenCalledWith("user1", 50);
    expect(message.result.prompts).toEqual([
      {
        name: "explain-code-ab12cd34",
        title: "Explain code",
        arguments: [
          { name: "code", required: false },
          { name: "tone", description: "Default: plain", required: false },
        ],
      },
    ]);
  });

  it("returns a prompt filled with the arguments, by its full name only", async () => {
    const message = await rpcMessage(await call({ method: "prompts/get", params: { name: "explain-code-ab12cd34", arguments: { code: "this diff" } } }));

    expect(findMcpPromptRows).toHaveBeenCalledWith("user1", "ab12cd34");
    expect(message.result.messages).toEqual([{ role: "user", content: { type: "text", text: "Explain this diff in plain words." } }]);

    const wrong = await rpcMessage(await call({ method: "prompts/get", params: { name: "other-title-ab12cd34" } }));
    expect(wrong.error.code).toBe(-32602);
  });
});
