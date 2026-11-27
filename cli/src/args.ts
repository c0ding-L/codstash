import { parseArgs, type ParseArgsConfig } from "node:util";

import { UsageError } from "./errors";

export type Command =
  | { name: "help"; topic?: CommandName }
  | { name: "version" }
  | { name: "login"; url?: string }
  | { name: "logout" }
  | { name: "whoami" }
  | { name: "search"; query: string; type?: string; tag?: string; limit?: number; json: boolean }
  | { name: "get"; id: string; copy: boolean; raw: boolean }
  | { name: "run"; target: string; yes: boolean }
  | { name: "save"; type: string; title: string; tags: string[]; language?: string; file?: string }
  | { name: "context"; id: string; output?: string };

export type CommandName = Exclude<Command["name"], "help" | "version">;

export const COMMAND_NAMES: readonly CommandName[] = [
  "login",
  "logout",
  "whoami",
  "search",
  "get",
  "run",
  "save",
  "context",
];

type Options = NonNullable<ParseArgsConfig["options"]>;

const HELP: Options = { help: { type: "boolean", short: "h" } };

/** Each command's flags, and how many positionals it takes: [min, max]. */
const SPECS: Record<CommandName, { options: Options; positionals: [number, number] }> = {
  login: { options: { url: { type: "string" } }, positionals: [0, 0] },
  logout: { options: {}, positionals: [0, 0] },
  whoami: { options: {}, positionals: [0, 0] },
  search: {
    options: { type: { type: "string" }, tag: { type: "string" }, limit: { type: "string" }, json: { type: "boolean" } },
    positionals: [1, Infinity],
  },
  get: { options: { copy: { type: "boolean" }, raw: { type: "boolean" } }, positionals: [1, 1] },
  run: { options: { yes: { type: "boolean", short: "y" } }, positionals: [1, Infinity] },
  save: {
    options: {
      type: { type: "string" },
      title: { type: "string" },
      tags: { type: "string" },
      language: { type: "string" },
    },
    positionals: [0, 1],
  },
  context: { options: { output: { type: "string", short: "o" } }, positionals: [1, 1] },
};

function isCommandName(value: string): value is CommandName {
  return (COMMAND_NAMES as readonly string[]).includes(value);
}

/** A string flag, trimmed; blank counts as absent. */
function text(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

/** The command line, without `node` and the script: `process.argv.slice(2)`. */
export function parseCommand(argv: readonly string[]): Command {
  const [first, ...rest] = argv;
  if (first === undefined || first === "--help" || first === "-h" || first === "help") {
    const topic = first === "help" && rest[0] && isCommandName(rest[0]) ? rest[0] : undefined;
    return { name: "help", topic };
  }
  if (first === "--version" || first === "-v") return { name: "version" };
  if (!isCommandName(first)) throw new UsageError(`Unknown command "${first}".`);

  const spec = SPECS[first];
  let parsed: { values: Record<string, unknown>; positionals: string[] };
  try {
    parsed = parseArgs({
      args: [...rest],
      options: { ...spec.options, ...HELP },
      allowPositionals: true,
      strict: true,
    });
  } catch (error) {
    // parseArgs' own messages are clear ("Unknown option '--foo'"); keep only the first sentence.
    const message = error instanceof Error ? error.message.split(". ")[0]! : String(error);
    throw new UsageError(message.endsWith(".") ? message : `${message}.`, first);
  }

  const { values, positionals } = parsed;
  if (values.help) return { name: "help", topic: first };

  const [min, max] = spec.positionals;
  if (positionals.length < min) throw new UsageError("Missing argument.", first);
  if (positionals.length > max) throw new UsageError(`Unexpected argument "${positionals[max]}".`, first);

  switch (first) {
    case "login":
      return { name: "login", url: text(values.url) };
    case "logout":
    case "whoami":
      return { name: first };
    case "search": {
      let limit: number | undefined;
      if (values.limit !== undefined) {
        limit = Number(values.limit);
        if (!Number.isInteger(limit) || limit < 1) throw new UsageError("--limit must be a whole number from 1.", first);
      }
      const query = positionals.join(" ").trim();
      if (!query) throw new UsageError("Missing argument.", first);
      return { name: "search", query, type: text(values.type), tag: text(values.tag), limit, json: Boolean(values.json) };
    }
    case "get":
      return { name: "get", id: positionals[0]!, copy: Boolean(values.copy), raw: Boolean(values.raw) };
    case "run": {
      const target = positionals.join(" ").trim();
      if (!target) throw new UsageError("Missing argument.", first);
      return { name: "run", target, yes: Boolean(values.yes) };
    }
    case "save": {
      const title = text(values.title);
      if (!title) throw new UsageError("--title is required.", first);
      const tags = (text(values.tags) ?? "")
        .split(",")
        .map((tag) => tag.trim())
        .filter(Boolean);
      return {
        name: "save",
        type: text(values.type) ?? "note",
        title,
        tags,
        language: text(values.language),
        file: positionals[0],
      };
    }
    case "context":
      return { name: "context", id: positionals[0]!, output: text(values.output) };
  }
}
