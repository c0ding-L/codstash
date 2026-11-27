import { spawn } from "node:child_process";
import { constants } from "node:os";

import { findItem, shortId, type ApiClient, type ApiItem } from "./api";
import { BIN } from "./constants";
import { hasControlChars, normalizeNewlines, showControlChars } from "./controls";
import { CliError } from "./errors";
import { fillInteractive } from "./fill";

export interface RunDeps {
  client: ApiClient;
  ask: (question: string) => Promise<string>;
  /** Runs the final command in the user's shell; resolves with its exit code. */
  spawnCommand: (command: string) => Promise<number>;
  /** Lets go of stdin (closes the prompts), so the command reads the terminal undisturbed. */
  releaseInput: () => void;
  /** Messages for the user (stderr): stdout belongs to the command. */
  say: (line: string) => void;
  /** stdin is a terminal: prompts and the confirmation are possible. */
  interactive: boolean;
}

const PICK_LIMIT = 20;

/** The command for an id, or a search among the commands; several matches give a numbered pick. */
async function pickCommand(target: string, { client, ask, say, interactive }: RunDeps): Promise<ApiItem> {
  if (!/\s/.test(target)) {
    const item = await findItem(client, target);
    if (item) {
      if (item.type.slug !== "command") {
        throw new CliError(
          `"${showControlChars(item.title)}" is a ${showControlChars(item.type.name.toLowerCase())}, not a command.`,
          `\`${BIN} run\` only runs commands.`,
        );
      }
      return item;
    }
  }

  const matches = await client.listItems({ q: target, type: "command", limit: PICK_LIMIT });
  if (matches.length === 0) throw new CliError(`No command matches "${target}".`);
  if (matches.length === 1) return client.getItem(matches[0]!.id);
  if (!interactive) throw new CliError(`${matches.length} commands match "${target}".`, "Use an id to pick one.");

  matches.forEach((item, index) =>
    say(`  ${String(index + 1).padStart(2)}) ${shortId(item.id)}  ${showControlChars(item.title)}`),
  );
  const answer = await ask(`Pick a command [1-${matches.length}]: `);
  const choice = Number(answer);
  if (!Number.isInteger(choice) || choice < 1 || choice > matches.length) throw new CliError("No command picked.");
  // The list holds a 300-character preview of the content.
  return client.getItem(matches[choice - 1]!.id);
}

/** Throws when the text holds control characters; `say` first shows it with them escaped. */
function refuseControlChars(text: string, say?: (line: string) => void) {
  if (!hasControlChars(text)) return;
  if (say) {
    say("");
    say(`  ${showControlChars(text).split("\n").join("\n  ")}`);
    say("");
  }
  throw new CliError(
    "This command contains control characters (shown escaped above), so what the terminal shows may not be what runs.",
    "Remove them in the app, then run it again.",
  );
}

/**
 * `cortex run`: resolves the command, fills its variables, shows the final command and asks
 * before running it. `yes` skips the question. Resolves with the exit code to leave with.
 */
export async function runCommand(target: string, { yes }: { yes: boolean }, deps: RunDeps): Promise<number> {
  const { ask, say, interactive, spawnCommand, releaseInput } = deps;
  if (!interactive && !yes) {
    throw new CliError("Running a command needs a terminal to confirm it.", "Pass --yes to run it without asking.");
  }

  const item = await pickCommand(target, deps);
  const content = normalizeNewlines(item.content ?? "").trim();
  if (!content) throw new CliError(`"${showControlChars(item.title)}" has no content to run.`);
  // Refused before any prompt, so nothing stored reaches the terminal raw.
  refuseControlChars(content, say);

  const command = normalizeNewlines(await fillInteractive(content, ask, interactive));
  say("");
  say(`  ${showControlChars(command).split("\n").join("\n  ")}`);
  say("");

  // Checked again after filling: a typed value could hold one too. Never run, even with --yes.
  refuseControlChars(command);

  if (!yes) {
    const answer = await ask("Run? [y/N] ");
    if (!/^y(es)?$/i.test(answer)) {
      say("Not run.");
      return 1;
    }
  }
  releaseInput();
  return spawnCommand(command);
}

/** The shell `run` uses: `$SHELL -c`, or `cmd /c` on Windows (Node adds the flags). */
export function userShell(platform: NodeJS.Platform, env: NodeJS.ProcessEnv): string {
  return platform === "win32" ? env.ComSpec || "cmd.exe" : env.SHELL || "/bin/sh";
}

/**
 * Runs the command with stdio inherited and resolves with its exit code; a signal gives 128 + its
 * number, as a shell does. Ctrl+C goes to the child, so this process ignores it meanwhile.
 */
export function spawnInShell(
  command: string,
  platform: NodeJS.Platform = process.platform,
  env: NodeJS.ProcessEnv = process.env,
): Promise<number> {
  return new Promise((resolve, reject) => {
    const ignore = () => {};
    process.on("SIGINT", ignore);
    const child = spawn(command, { shell: userShell(platform, env), stdio: "inherit" });
    child.on("error", (error) => {
      process.off("SIGINT", ignore);
      reject(new CliError(`Could not start the shell: ${error.message}`));
    });
    child.on("close", (code, signal) => {
      process.off("SIGINT", ignore);
      resolve(code ?? (signal ? 128 + (constants.signals[signal] ?? 0) : 1));
    });
  });
}
