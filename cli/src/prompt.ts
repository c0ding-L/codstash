import { createInterface, type Interface } from "node:readline/promises";

import { CliError } from "./errors";

/** Questions on stderr, answers from stdin, so stdout stays the command's output. */
export interface Prompter {
  ask(question: string): Promise<string>;
  close(): void;
}

/** Ctrl+C at a prompt: leave as a shell does on SIGINT, with nothing run. */
function interrupted(output: NodeJS.WriteStream): never {
  output.write("\n");
  process.exit(130);
}

export function createPrompter(
  input: NodeJS.ReadStream = process.stdin,
  output: NodeJS.WriteStream = process.stderr,
  onInterrupt: () => void = () => interrupted(output),
): Prompter {
  // One interface for the whole run: a new one per question would lose piped input it buffered.
  let rl: Interface | undefined;
  return {
    async ask(question) {
      if (!rl) {
        rl = createInterface({ input, output, terminal: Boolean(input.isTTY) });
        // Without a listener, readline only pauses stdin on Ctrl+C: the CLI would hang, or exit 0.
        rl.on("SIGINT", onInterrupt);
      }
      return (await rl.question(question)).trim();
    },
    close() {
      rl?.close();
      rl = undefined;
    },
  };
}

/**
 * A line typed without echo, for the token. Raw mode, so it needs a terminal; Ctrl+C aborts and
 * Backspace works.
 */
export function askHidden(
  question: string,
  input: NodeJS.ReadStream = process.stdin,
  output: NodeJS.WriteStream = process.stderr,
): Promise<string> {
  return new Promise((resolve, reject) => {
    output.write(question);
    let value = "";
    input.setRawMode(true);
    input.setEncoding("utf8");
    input.resume();

    const done = (error?: Error) => {
      input.setRawMode(false);
      input.pause();
      input.off("data", onData);
      output.write("\n");
      if (error) reject(error);
      else resolve(value.trim());
    };

    const onData = (chunk: string) => {
      for (const char of chunk) {
        if (char === "\r" || char === "\n") return done();
        if (char === "\u0003") return done(new CliError("Cancelled."));
        if (char === "\u007f" || char === "\b") value = value.slice(0, -1);
        else if (char >= " ") value += char;
      }
    };
    input.on("data", onData);
  });
}

/** All of stdin as text, for a piped token or `save`'s content. */
export async function readStdin(input: NodeJS.ReadStream = process.stdin): Promise<string> {
  let text = "";
  input.setEncoding("utf8");
  for await (const chunk of input) text += chunk;
  return text;
}
