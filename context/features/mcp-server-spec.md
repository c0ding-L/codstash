# C3 — MCP server

## Overview

Cortex becomes the external memory of the user's AI coding assistants. A Model Context
Protocol endpoint lets Claude Code, Cursor or any other MCP client search, read and save items
and pull a collection's context. It uses the same tokens (C1) and rules as the REST API (C2).
Roadmap: `docs/roadmap-v2.md` § C3.

## Requirements

### Transport and library

- Endpoint `/api/mcp`, **Streamable HTTP**, **stateless**: no session store, so every request
  stands alone, which fits serverless.
- Library:
  - Before writing code, check with Context7 both the official `@modelcontextprotocol/sdk`
    (its web-standard Streamable HTTP server transport) and Vercel's `mcp-handler` adapter.
  - Pick the one that works with Next 16 route handlers and the current SDK, and write the
    choice and its version in the History.
  - Install through Windows npm.
- Auth:
  - `Authorization: Bearer cstash_…`, checked with `authenticateApi` before the MCP handler
    runs.
  - Read tools need `read`. Write tools need `write` and Pro, and fail with a tool error (not a
    transport error) explaining why.
  - MCP OAuth is **out of scope** for v1: Claude Code and Cursor both accept a header.
- `maxDuration = 60`. The same `api` / `apiWrite` rate limits.

### Tools

| Tool | Scope | Input | Output (text content) |
| --- | --- | --- | --- |
| `search_items` | read | `query`, `type?`, `tag?`, `limit?` (≤ 20) | Lines `id · type · title · tags`, plus the first 200 characters of content. |
| `get_item` | read | `id` | Title, type, language, tags, description, then the content fenced (A3's rendering for one item). |
| `list_collections` | read | — | `id · name · itemCount · description (first line)`. |
| `get_collection_context` | read | `id` | A3's `renderCollectionContext`, capped at 100,000 characters for an assistant context. |
| `create_item` | write | `type` (snippet, prompt, note, command, link, custom slug), `title`, `content?`, `url?`, `language?`, `tags?`, `collectionId?` | `Created <id>: <title>`. |

- Tool descriptions are written for an LLM: when to use the tool, what comes back, and that
  results are the user's own notes.
- `create_item` runs A6's detector on its input. When something matches, the item is still
  created, and the result adds "⚠ Possible secret detected (kind). Review it in Cortex."
- `get_item` and `get_collection_context` add the same warning line when an item matches.
- Errors are returned as MCP tool errors (`isError: true`) with a short English message.

### MCP prompts (optional; second commit in the same feature)

- Each **prompt** item becomes an MCP prompt.
  - Name: the slugified title plus `-` and `shortId(id)` (A1: the last 8 characters, never the
    first).
  - Arguments: B's `parseVariables` (name, default → description).
  - `prompts/get` returns the text filled with `fillVariables`.
- At most the 50 most recently updated prompts, to keep `prompts/list` small.

### Setup UI (Settings › API tokens, below the token list)

- An "Connect an AI assistant" card shows copy-ready snippets, with the app URL taken from
  `AUTH_URL` / the request origin:
  - Claude Code: `claude mcp add --transport http cortex <origin>/api/mcp --header
    "Authorization: Bearer <token>"`
  - Cursor `mcp.json`: `{ "mcpServers": { "cortex": { "url": "<origin>/api/mcp", "headers":
    { "Authorization": "Bearer <token>" } } } }`
- The `<token>` placeholder is filled automatically only in the one-time view after a token is
  created. Otherwise it stays a placeholder.

## Testing

- `src/lib/mcp-tools.test.ts`: the tool handlers as plain functions, separate from the
  transport.
  - Each tool's output format.
  - Owner scope (db mocked).
  - A write tool with a read token or on Free gives a tool error.
  - The secret warning line.
  - The `get_collection_context` cap.
  - Prompt mapping from variables (if it is in this feature).
- Route test: 401 without a bearer, before any MCP processing. One `tools/list` request returns
  the five tools (JSON-RPC body).
- Manual:
  - Connect Claude Code to `next dev` with a develop token.
  - Ask it to search and then fetch a snippet, and to create a note. Check the note in the UI.
  - Write the transcript summary in the History.

## Notes

- Tool output stays English (it is for the model). The user's content is passed through
  unchanged.
- Setup strings in `settings.mcp` (EN/FR).
