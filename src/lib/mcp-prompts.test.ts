import { describe, expect, it } from "vitest";

import { mcpPromptIdSuffix, mcpPromptName, renderMcpPrompt, toMcpPromptEntry } from "@/lib/mcp-prompts";

const row = {
  id: "cm0prompt000000000ab12cd34",
  title: "Review a pull request",
  description: "  Careful, kind review.  ",
  content: "Review {{pr}} in {{language:TypeScript}}, focus on {{focus:}}. Dated {{date}}, ref {{uuid:none}}. Keep \\{{raw}} and ${{ secrets.X }}.",
};

const fill = { now: new Date(2026, 10, 27), uuid: () => "uuid-1" };

describe("MCP prompts", () => {
  it("names a prompt after its slugified title and the last 8 characters of its id", () => {
    expect(mcpPromptName(row)).toBe("review-a-pull-request-ab12cd34");
    expect(mcpPromptName({ id: row.id, title: "✨" })).toBe("prompt-ab12cd34");
    expect(mcpPromptIdSuffix("review-a-pull-request-ab12cd34")).toBe("ab12cd34");
    expect(mcpPromptIdSuffix("no-suffix")).toBeNull();
  });

  it("maps the variables to optional arguments, defaults as descriptions, built-ins without a default left out", () => {
    expect(toMcpPromptEntry(row)).toEqual({
      name: "review-a-pull-request-ab12cd34",
      title: "Review a pull request",
      description: "Careful, kind review.",
      arguments: [
        { name: "pr", required: false },
        { name: "language", description: "Default: TypeScript", required: false },
        { name: "focus", description: "Default: (empty)", required: false },
        { name: "uuid", description: "Default: none", required: false },
      ],
    });
    expect(toMcpPromptEntry({ ...row, description: null, content: null })).toEqual({
      name: "review-a-pull-request-ab12cd34",
      title: "Review a pull request",
      arguments: [],
    });
  });

  it("fills the text with fillVariables as one user message", () => {
    expect(renderMcpPrompt(row, { pr: "#42", focus: "" }, fill)).toEqual({
      description: "Careful, kind review.",
      messages: [
        {
          role: "user",
          content: {
            type: "text",
            text: "Review #42 in TypeScript, focus on . Dated 2026-11-27, ref none. Keep {{raw}} and ${{ secrets.X }}.",
          },
        },
      ],
    });
  });
});
