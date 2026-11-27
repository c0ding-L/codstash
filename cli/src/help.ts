import type { CommandName } from "./args";
import { BIN, VERSION } from "./constants";

const USAGE: Record<CommandName, string> = {
  login: `Usage: ${BIN} login [--url <baseUrl>]

Asks for an API token (create one in Settings › API tokens), checks it and saves it.

  --url <baseUrl>   The app's address, e.g. http://localhost:3000. Defaults to the
                    saved one, then $CORTEX_URL, then the production URL.

The token can also be piped: echo "$TOKEN" | ${BIN} login`,

  logout: `Usage: ${BIN} logout

Deletes the saved token. The saved URL stays.`,

  whoami: `Usage: ${BIN} whoami

Shows who the token belongs to and the plan.`,

  search: `Usage: ${BIN} search <query> [--type <type>] [--tag <tag>] [--limit <n>] [--json]

Searches titles, descriptions, content and tags.

  --type <type>   snippet, prompt, command, note, link, file, image or a custom type
  --tag <tag>     An exact tag name
  --limit <n>     At most n results (20 by default, 50 at most)
  --json          The API's raw data instead of a table`,

  get: `Usage: ${BIN} get <id> [--copy] [--raw]

Prints an item's content (a link prints its URL). <id> is a full id or the short id
${BIN} search shows. Variables in prompts and commands are asked for and filled in.

  --copy   Copies to the clipboard instead of printing
  --raw    Leaves {{variables}} as they are`,

  run: `Usage: ${BIN} run <id | query> [--yes]

Runs a stored command in your shell ($SHELL -c, or cmd /c on Windows). A query that
matches several commands shows a numbered list to pick from. Each variable is asked
for, then the final command is shown and you confirm with "y".

  -y, --yes   Runs without asking. WARNING: the command runs exactly as stored,
              unseen; only use it with commands you trust, e.g. in scripts.

Exits with the command's exit code.`,

  save: `Usage: ${BIN} save --title <title> [--type <type>] [--tags a,b] [--language <l>] [file]

Saves a new item from a file, or from stdin when no file is given, and prints its id.
Needs a "Read + write" token and a Pro plan.

  --title <title>    Required
  --type <type>      note (default), snippet, prompt, command or a custom type
  --tags a,b         Comma-separated tags
  --language <l>     For snippets and commands, e.g. bash

Example: echo "docker system prune -af" | ${BIN} save --type command --title "Prune Docker"`,

  context: `Usage: ${BIN} context <collectionId> [-o <file>]

Writes a collection as a Markdown context file for an AI coding assistant.

  -o, --output <file>   Writes to the file instead of stdout

Example: ${BIN} context abcd1234 -o CONTEXT.md`,
};

export function commandUsage(command: CommandName): string {
  return USAGE[command];
}

export function mainHelp(): string {
  return `${BIN} ${VERSION}: your snippets, prompts and commands from the terminal.

Usage: ${BIN} <command> [options]

Commands:
  login       Save an API token
  logout      Delete the saved token
  whoami      Show the token's owner and plan
  search      Search your items
  get         Print or copy an item
  run         Run a stored command
  save        Save a new item from a file or stdin
  context     Export a collection as Markdown

Run "${BIN} <command> --help" for its options. "${BIN} --version" prints the version.

Environment: CORTEX_TOKEN and CORTEX_URL override the saved config. NO_COLOR turns colours off.`;
}
