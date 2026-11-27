import { describe, expect, it, vi } from "vitest";

import { fillInteractive } from "./fill";

const NOW = new Date(2026, 10, 27);

describe("fillInteractive", () => {
  it("asks for each variable with its default and fills the answers", async () => {
    const ask = vi.fn(async (question: string) => (question.startsWith("app") ? "api" : ""));
    expect(await fillInteractive("deploy {{app}} to {{env:prod}}", ask, true, NOW)).toBe("deploy api to prod");
    expect(ask.mock.calls.map(([question]) => question)).toEqual(["app: ", "env [prod]: "]);
  });

  it("shows a default's control characters escaped in the prompt", async () => {
    const ask = vi.fn(async (_question: string) => "");
    await fillInteractive("echo {{msg:hi\x1b[2K}}", ask, true, NOW);
    expect(ask).toHaveBeenCalledWith("msg [hi\\x1b[2K]: ");
  });

  it("asks nothing without a terminal and takes the defaults", async () => {
    const ask = vi.fn(async (_question: string) => "x");
    expect(await fillInteractive("echo {{who:world}} {{date}}", ask, false, NOW)).toBe("echo world 2026-11-27");
    expect(ask).not.toHaveBeenCalled();
  });
});
