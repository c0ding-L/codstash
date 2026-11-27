import { parseCommand } from "./args";
import { paint } from "./colors";
import { runParsed } from "./commands";
import { BIN, VERSION } from "./constants";
import { CliError, UsageError } from "./errors";
import { commandUsage, mainHelp } from "./help";
import { createPrompter } from "./prompt";

async function main(argv: string[]): Promise<number> {
  const colors = paint(process.stderr);
  const prompter = createPrompter();
  try {
    const command = parseCommand(argv);
    if (command.name === "help") {
      process.stdout.write(`${command.topic ? commandUsage(command.topic) : mainHelp()}\n`);
      return 0;
    }
    if (command.name === "version") {
      process.stdout.write(`${VERSION}\n`);
      return 0;
    }
    return await runParsed(command, {
      stdin: process.stdin,
      stdout: process.stdout,
      stderr: process.stderr,
      env: process.env,
      prompter,
      paint: colors,
    });
  } catch (error) {
    if (error instanceof UsageError) {
      process.stderr.write(`${colors.red(error.message)}\n`);
      process.stderr.write(`${error.command ? commandUsage(error.command) : `Run "${BIN} --help".`}\n`);
    } else if (error instanceof CliError) {
      process.stderr.write(`${colors.red(error.message)}\n`);
      if (error.hint) process.stderr.write(`${colors.dim(error.hint)}\n`);
    } else {
      process.stderr.write(`${colors.red(`Unexpected error: ${error instanceof Error ? error.message : String(error)}`)}\n`);
    }
    return 1;
  } finally {
    prompter.close();
  }
}

process.exitCode = await main(process.argv.slice(2));
