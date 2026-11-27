import type { CommandName } from "./args";

/** A mistake in the command line: printed with the command's usage, exit code 1. */
export class UsageError extends Error {
  constructor(
    message: string,
    readonly command?: CommandName,
  ) {
    super(message);
    this.name = "UsageError";
  }
}

/** An expected failure with a message for the user, and an optional hint on a second line. */
export class CliError extends Error {
  constructor(
    message: string,
    readonly hint?: string,
  ) {
    super(message);
    this.name = "CliError";
  }
}
