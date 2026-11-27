import { describe, expect, it } from "vitest";

import { appOrigin, claudeCodeCommand, cursorConfig, MCP_TOKEN_PLACEHOLDER } from "@/lib/mcp-setup";

const headers = (values: Record<string, string>) => new Headers(values);

describe("MCP setup snippets", () => {
  it("builds the Claude Code command, with the placeholder unless a token is given", () => {
    expect(claudeCodeCommand("https://app.example.com/")).toBe(
      `claude mcp add --transport http cortex https://app.example.com/api/mcp --header "Authorization: Bearer ${MCP_TOKEN_PLACEHOLDER}"`,
    );
    expect(claudeCodeCommand("https://app.example.com", "cstash_abc")).toContain('"Authorization: Bearer cstash_abc"');
  });

  it("builds Cursor's mcp.json", () => {
    expect(JSON.parse(cursorConfig("http://localhost:3000", "cstash_abc"))).toEqual({
      mcpServers: { cortex: { url: "http://localhost:3000/api/mcp", headers: { Authorization: "Bearer cstash_abc" } } },
    });
  });
});

describe("appOrigin", () => {
  it("prefers AUTH_URL, without a path", () => {
    expect(appOrigin({ AUTH_URL: "https://b.example.com/api/auth" }, headers({ host: "localhost:3000" }))).toBe("https://b.example.com");
  });

  it("falls back to the request's forwarded host and protocol", () => {
    expect(appOrigin({}, headers({ "x-forwarded-host": "codstash.app", "x-forwarded-proto": "https" }))).toBe("https://codstash.app");
    expect(appOrigin({}, headers({ host: "localhost:3000" }))).toBe("http://localhost:3000");
  });
});
