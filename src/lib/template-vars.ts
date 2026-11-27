/**
 * Variables in prompts and commands (roadmap § B): `{{name}}` and `{{name:default}}`, filled in
 * before a copy. Pure, with no Next or React import: the CLI and the MCP server reuse it.
 *
 * Not variables, so existing content never breaks: `${{ … }}` (GitHub Actions), names with a dot
 * or a space (`{{ secrets.X }}`, `{{ .Values }}`, Jinja and Handlebars paths), and `\{{name}}`,
 * which is escaped and fills to the literal `{{name}}`.
 */

export interface Variable {
  name: string;
  /** The text after `:`, trimmed. The first default given for a name wins. */
  default?: string;
  /** `date` or `uuid`: filled in by the app, so it gets no field unless the text gives a default. */
  builtin?: boolean;
}

export interface FillOptions {
  now: Date;
  uuid: () => string;
}

/** Item types whose content is templated. Snippets and notes hold code, where `{{ }}` is common. */
const TEMPLATED_TYPES = new Set(["prompt", "command"]);

const BUILTINS = new Set(["date", "uuid"]);

/**
 * An optional `$` or `\` before `{{`, the name, and an optional default. Spaces and tabs only
 * around the name, so a variable stays on one line. The default is capped at 200 characters: an
 * unclosed `{{a:` then scans only that far, and a long text full of them stays linear.
 */
const VARIABLE = /([$\\]?)\{\{[ \t]*([a-zA-Z_][a-zA-Z0-9_-]{0,39})[ \t]*(?::([^}]{0,200}))?\}\}/g;

/** True for the system types whose copy goes through the variables form. */
export function isTemplatedType(slug: string | null | undefined): boolean {
  return slug != null && TEMPLATED_TYPES.has(slug);
}

/** The variables in the text, unique by name, in the order they first appear. */
export function parseVariables(text: string): Variable[] {
  const found = new Map<string, Variable>();
  for (const [, prefix, name, rawDefault] of text.matchAll(VARIABLE)) {
    if (prefix || found.has(name!)) continue;
    const variable: Variable = { name: name! };
    if (rawDefault !== undefined) variable.default = rawDefault.trim();
    if (BUILTINS.has(name!)) variable.builtin = true;
    found.set(name!, variable);
  }
  return [...found.values()];
}

/** The variables the form asks for: every one but a built-in without a default. */
export function variableFields(variables: Variable[]): Variable[] {
  return variables.filter((variable) => !variable.builtin || variable.default !== undefined);
}

/** `YYYY-MM-DD` in local time. */
function localDate(now: Date): string {
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

/**
 * The text with every variable replaced: the value given, else the first default in the text,
 * else the built-in's value, else an empty string. An empty value counts as missing, so a field
 * left blank takes its default. `\{{name}}` loses its backslash; `${{ … }}` is left alone.
 */
export function fillVariables(text: string, values: Record<string, string>, { now, uuid }: FillOptions): string {
  const defaults = new Map(parseVariables(text).map((variable) => [variable.name, variable.default]));
  let id: string | undefined;
  const builtin = (name: string) => {
    if (name === "date") return localDate(now);
    id ??= uuid();
    return id;
  };

  return text.replace(VARIABLE, (match: string, prefix: string, name: string) => {
    if (prefix === "$") return match;
    if (prefix === "\\") return match.slice(1);
    const value = Object.hasOwn(values, name) ? values[name] : undefined;
    if (value) return value;
    const fallback = defaults.get(name);
    if (fallback !== undefined) return fallback;
    return BUILTINS.has(name) ? builtin(name) : "";
  });
}

/** A piece of the text for display: plain text, or one variable as written. */
export type TemplateSegment = { kind: "text"; text: string } | { kind: "variable"; text: string; name: string };

/** Splits the text into plain runs and variables, for highlighting. Joining the pieces gives the text back. */
export function templateSegments(text: string): TemplateSegment[] {
  const segments: TemplateSegment[] = [];
  let last = 0;
  for (const match of text.matchAll(VARIABLE)) {
    if (match[1]) continue;
    if (match.index > last) segments.push({ kind: "text", text: text.slice(last, match.index) });
    segments.push({ kind: "variable", text: match[0], name: match[2]! });
    last = match.index + match[0].length;
  }
  if (last < text.length) segments.push({ kind: "text", text: text.slice(last) });
  return segments;
}
