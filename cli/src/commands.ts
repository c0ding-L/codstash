import { readFile, writeFile } from "node:fs/promises";

import { isTemplatedType } from "../../src/lib/template-vars";
import { ApiClient, resolveCollectionId, resolveItem, shortId, type ApiItem, type ApiMe } from "./api";
import type { Command } from "./args";
import { copyToClipboard } from "./clipboard";
import type { Paint } from "./colors";
import { configPath, readConfig, resolveConfig, trimUrl, writeConfig } from "./config";
import { BIN, DEFAULT_BASE_URL } from "./constants";
import { CliError, UsageError } from "./errors";
import { fillInteractive } from "./fill";
import { askHidden, readStdin, type Prompter } from "./prompt";
import { runCommand, spawnInShell } from "./run";

export interface Io {
  stdin: NodeJS.ReadStream;
  stdout: NodeJS.WriteStream;
  stderr: NodeJS.WriteStream;
  env: NodeJS.ProcessEnv;
  prompter: Prompter;
  /** Colours for stderr, where messages go. */
  paint: Paint;
}

type Run<C extends Command["name"]> = (command: Extract<Command, { name: C }>, io: Io) => Promise<number>;

const say = (io: Io, line: string) => io.stderr.write(`${line}\n`);

/** Ends with a newline, so the shell prompt starts on its own line. */
const withNewline = (text: string) => (text.endsWith("\n") ? text : `${text}\n`);

const plan = (me: ApiMe) => (me.isPro ? "Pro" : "Free");

async function client(io: Io): Promise<ApiClient> {
  const config = resolveConfig(await readConfig(), io.env);
  if (!config.token) throw new CliError("Not logged in.", `Run \`${BIN} login\`, or set CORTEX_TOKEN.`);
  return new ApiClient(config.baseUrl, config.token);
}

const login: Run<"login"> = async ({ url }, io) => {
  const stored = await readConfig();
  const baseUrl = trimUrl(url ?? (io.env.CORTEX_URL || stored.baseUrl || DEFAULT_BASE_URL));
  if (!/^https?:\/\/[^/]/.test(baseUrl)) throw new UsageError(`"${baseUrl}" is not an http(s) URL.`, "login");

  say(io, `Create a token in Settings › API tokens on ${baseUrl}`);
  const token = io.stdin.isTTY ? await askHidden("Token: ", io.stdin, io.stderr) : (await readStdin(io.stdin)).trim();
  if (!token) throw new CliError("No token given.");

  const me = await new ApiClient(baseUrl, token).me();
  await writeConfig({ baseUrl, token });
  say(io, `Logged in as ${me.name || me.email} (${plan(me)}).`);
  say(io, io.paint.dim(`Saved to ${configPath()}`));
  if (io.env.CORTEX_TOKEN) say(io, io.paint.yellow("CORTEX_TOKEN is set: it is used instead of the saved token."));
  return 0;
};

const logout: Run<"logout"> = async (_command, io) => {
  const { token, ...rest } = await readConfig();
  if (!token) {
    say(io, "Not logged in.");
  } else {
    await writeConfig(rest);
    say(io, "Logged out.");
  }
  if (io.env.CORTEX_TOKEN) say(io, io.paint.yellow("CORTEX_TOKEN is still set in the environment."));
  return 0;
};

const whoami: Run<"whoami"> = async (_command, io) => {
  const api = await client(io);
  const me = await api.me();
  io.stdout.write(`${me.name ? `${me.name} <${me.email}>` : me.email} (${plan(me)})\n`);
  say(io, io.paint.dim(api.baseUrl));
  return 0;
};

/** Pads to the width, or cuts with an ellipsis. */
function cell(text: string, width: number) {
  return text.length > width ? `${text.slice(0, width - 1)}…` : text.padEnd(width);
}

export function itemsTable(items: ApiItem[]): string {
  const typeWidth = Math.max(4, ...items.map((item) => item.type.slug.length));
  const titleWidth = Math.min(60, Math.max(5, ...items.map((item) => item.title.length)));
  const header = `${cell("ID", 8)}  ${cell("TYPE", typeWidth)}  ${cell("TITLE", titleWidth)}  TAGS`;
  const rows = items.map(
    (item) =>
      `${shortId(item.id)}  ${cell(item.type.slug, typeWidth)}  ${cell(item.title, titleWidth)}  ${item.tags.join(", ")}`.trimEnd(),
  );
  return [header, ...rows].join("\n");
}

const search: Run<"search"> = async ({ query, type, tag, limit, json }, io) => {
  const items = await (await client(io)).listItems({ q: query, type, tag, limit });
  if (json) {
    io.stdout.write(`${JSON.stringify(items, null, 2)}\n`);
  } else if (items.length === 0) {
    say(io, "No items match.");
  } else {
    io.stdout.write(`${itemsTable(items)}\n`);
  }
  return 0;
};

const get: Run<"get"> = async ({ id, copy, raw }, io) => {
  const item = await resolveItem(await client(io), id);
  let text: string;
  if (item.type.slug === "link") {
    text = item.url ?? "";
  } else if (item.content == null) {
    throw new CliError(`"${item.title}" is a ${item.type.slug} item: the API does not serve files.`);
  } else {
    text = item.content;
    if (!raw && isTemplatedType(item.type.slug)) {
      text = await fillInteractive(text, (question) => io.prompter.ask(question), Boolean(io.stdin.isTTY));
    }
  }

  if (copy) {
    await copyToClipboard(text);
    say(io, `Copied "${item.title}" to the clipboard.`);
  } else {
    io.stdout.write(withNewline(text));
  }
  return 0;
};

const run: Run<"run"> = async ({ target, yes }, io) => {
  if (yes) say(io, io.paint.yellow("--yes: running without confirmation."));
  return runCommand(target, { yes }, {
    client: await client(io),
    ask: (question) => io.prompter.ask(question),
    spawnCommand: (command) => spawnInShell(command),
    releaseInput: () => io.prompter.close(),
    say: (line) => say(io, line),
    interactive: Boolean(io.stdin.isTTY),
  });
};

const save: Run<"save"> = async ({ type, title, tags, language, file }, io) => {
  let content: string;
  if (file) {
    try {
      content = await readFile(file, "utf8");
    } catch (error) {
      throw new CliError(`Could not read ${file}: ${(error as Error).message}`);
    }
  } else if (io.stdin.isTTY) {
    throw new UsageError("Give a file, or pipe the content.", "save");
  } else {
    content = await readStdin(io.stdin);
  }
  // `echo` and most files end with a newline that is not part of the item.
  content = content.replace(/\r?\n$/, "");

  const item = await (await client(io)).createItem({
    type,
    title,
    content,
    ...(language && { language }),
    tags,
    collectionIds: [],
  });
  io.stdout.write(`${item.id}\n`);
  say(io, `Saved "${item.title}" (${shortId(item.id)}).`);
  return 0;
};

const context: Run<"context"> = async ({ id, output }, io) => {
  const api = await client(io);
  const markdown = await api.collectionContext(await resolveCollectionId(api, id));
  if (output) {
    await writeFile(output, markdown);
    say(io, `Wrote ${output}.`);
  } else {
    io.stdout.write(withNewline(markdown));
  }
  return 0;
};

/** Runs a parsed command (not help or version) and resolves with the exit code. */
export function runParsed(command: Exclude<Command, { name: "help" | "version" }>, io: Io): Promise<number> {
  switch (command.name) {
    case "login":
      return login(command, io);
    case "logout":
      return logout(command, io);
    case "whoami":
      return whoami(command, io);
    case "search":
      return search(command, io);
    case "get":
      return get(command, io);
    case "run":
      return run(command, io);
    case "save":
      return save(command, io);
    case "context":
      return context(command, io);
  }
}
