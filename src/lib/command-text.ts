/** How a piece of a shell command is coloured in the command list. */
export type CommandTokenKind = "program" | "flag" | "operator" | "string" | "plain";

export interface CommandToken {
  text: string;
  kind: CommandTokenKind;
}

/** Above this, the list sends the start of the command and the copy button fetches the rest. */
export const MAX_COMMAND_CHARS = 2_000;

// Whitespace, a quoted string (an unclosed one runs to the end), an operator, or a word.
// Redirects come first among the operators, so `2>&1` and `&>` are not read as a
// background `&` followed by a new program.
const TOKEN =
  /(\s+)|("(?:[^"\\]|\\.)*(?:"|$)|'[^']*(?:'|$))|(\d*>&\d+|&>>?|\d*>>?|\|\||&&|[|;&<])|([^\s|&;<>"']+)/g;

/** After these, the next word is a new program. Redirects (`>`, `<`) are not among them. */
const STARTS_COMMAND = new Set(["|", "||", "&&", ";", "&"]);

const ENV_ASSIGNMENT = /^[A-Za-z_][A-Za-z0-9_]*=/;

/**
 * Splits one line of shell into coloured pieces: the program (the first word, and
 * the first word after a pipe or a separator), flags, operators and quoted strings.
 * Good enough to colour a list, not a parser. Joining the tokens gives the line back.
 */
export function tokenizeCommand(line: string): CommandToken[] {
  const tokens: CommandToken[] = [];
  let expectProgram = true;

  for (const [text, space, str, op, word] of line.matchAll(TOKEN)) {
    if (space) {
      tokens.push({ text, kind: "plain" });
    } else if (str) {
      tokens.push({ text, kind: "string" });
      expectProgram = false;
    } else if (op) {
      tokens.push({ text, kind: "operator" });
      if (STARTS_COMMAND.has(op)) expectProgram = true;
    } else if (word) {
      if (expectProgram && ENV_ASSIGNMENT.test(word)) {
        tokens.push({ text, kind: "plain" });
      } else if (expectProgram) {
        tokens.push({ text, kind: "program" });
        expectProgram = false;
      } else {
        tokens.push({ text, kind: word.length > 1 && word.startsWith("-") ? "flag" : "plain" });
      }
    }
  }

  return tokens;
}

/** The first non-blank line, trailing spaces trimmed, and whether any non-blank line follows. */
export function commandFirstLine(content: string): { line: string; hasMore: boolean } {
  const lines = content.split(/\r?\n/).map((l) => l.trimEnd());
  const first = lines.findIndex((l) => l.trim());
  if (first === -1) return { line: "", hasMore: false };

  return { line: lines[first]!, hasMore: lines.slice(first + 1).some((l) => l.trim()) };
}

/** The command as the list sends it: whole up to `MAX_COMMAND_CHARS`, cut beyond. */
export function clipCommand(content: string): { text: string; isCut: boolean } {
  return content.length > MAX_COMMAND_CHARS
    ? { text: content.slice(0, MAX_COMMAND_CHARS), isCut: true }
    : { text: content, isCut: false };
}
