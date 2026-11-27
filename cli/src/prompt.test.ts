import { PassThrough } from "node:stream";

import { describe, expect, it, vi } from "vitest";

import { createPrompter } from "./prompt";

/** A fake terminal: readline only turns Ctrl+C into SIGINT on a TTY. */
function terminal() {
  const input = Object.assign(new PassThrough(), { isTTY: true, setRawMode: vi.fn() }) as unknown as NodeJS.ReadStream;
  const output = new PassThrough() as unknown as NodeJS.WriteStream;
  return { input, output };
}

describe("createPrompter", () => {
  it("returns the trimmed answer", async () => {
    const { input, output } = terminal();
    const prompter = createPrompter(input, output, vi.fn());
    const answer = prompter.ask("app: ");
    input.write("  api \r");
    expect(await answer).toBe("api");
    prompter.close();
  });

  it("calls onInterrupt on Ctrl+C instead of leaving the question hanging", async () => {
    const { input, output } = terminal();
    const onInterrupt = vi.fn();
    const prompter = createPrompter(input, output, onInterrupt);
    void prompter.ask("Run? [y/N] ");
    input.write("\u0003");
    await vi.waitFor(() => expect(onInterrupt).toHaveBeenCalledOnce());
    prompter.close();
  });
});
