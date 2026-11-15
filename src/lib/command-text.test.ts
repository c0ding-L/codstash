import { describe, expect, it } from "vitest";

import { clipCommand, commandFirstLine, MAX_COMMAND_CHARS, tokenizeCommand } from "@/lib/command-text";

/** The tokens as `kind:text` pairs, whitespace left out, to keep the expectations readable. */
function kinds(line: string) {
  return tokenizeCommand(line)
    .filter((t) => t.text.trim())
    .map((t) => `${t.kind}:${t.text}`);
}

describe("tokenizeCommand", () => {
  it("gives back the line exactly when the tokens are joined", () => {
    const line = `npx  prisma migrate deploy && echo "a  b" | tail -20 > out.txt`;

    expect(tokenizeCommand(line).map((t) => t.text).join("")).toBe(line);
  });

  it("marks the program, its flags and its arguments", () => {
    expect(kinds("docker system prune -af --volumes")).toEqual([
      "program:docker",
      "plain:system",
      "plain:prune",
      "flag:-af",
      "flag:--volumes",
    ]);
  });

  it("starts a new program after a pipe, &&, || and ;", () => {
    expect(kinds("a | b && c || d ; e")).toEqual([
      "program:a",
      "operator:|",
      "program:b",
      "operator:&&",
      "program:c",
      "operator:||",
      "program:d",
      "operator:;",
      "program:e",
    ]);
  });

  it("does not start a new program after a redirect", () => {
    expect(kinds("ls -la > files.txt")).toEqual([
      "program:ls",
      "flag:-la",
      "operator:>",
      "plain:files.txt",
    ]);
  });

  it("reads 2>&1 as one redirect, not as a background & starting a program", () => {
    expect(kinds("npm run build > out.log 2>&1")).toEqual([
      "program:npm",
      "plain:run",
      "plain:build",
      "operator:>",
      "plain:out.log",
      "operator:2>&1",
    ]);
  });

  it("reads 2> and &> as redirects", () => {
    expect(kinds("make 2> err.log &> all.log")).toEqual([
      "program:make",
      "operator:2>",
      "plain:err.log",
      "operator:&>",
      "plain:all.log",
    ]);
  });

  it("starts a new program after a background &", () => {
    expect(kinds("tail -f log & echo hi")).toEqual([
      "program:tail",
      "flag:-f",
      "plain:log",
      "operator:&",
      "program:echo",
      "plain:hi",
    ]);
  });

  it("keeps a single-quoted string whole and an escaped double quote inside one", () => {
    expect(kinds(`echo 'a | b' "say \\"hi\\" | x"`)).toEqual([
      "program:echo",
      "string:'a | b'",
      `string:"say \\"hi\\" | x"`,
    ]);
  });

  it("keeps a quoted string whole, operators and spaces included", () => {
    expect(kinds(`git commit -m "fix: a | b"`)).toEqual([
      "program:git",
      "plain:commit",
      "flag:-m",
      `string:"fix: a | b"`,
    ]);
  });

  it("skips environment assignments before the program", () => {
    expect(kinds("NODE_ENV=production node server.js")).toEqual([
      "plain:NODE_ENV=production",
      "program:node",
      "plain:server.js",
    ]);
  });

  it("keeps an unclosed quote to the end of the line", () => {
    expect(kinds(`echo "unfinished`)).toEqual(["program:echo", `string:"unfinished`]);
  });

  it("does not treat a lone dash as a flag", () => {
    expect(kinds("cat -")).toEqual(["program:cat", "plain:-"]);
  });

  it("returns nothing for an empty line", () => {
    expect(tokenizeCommand("")).toEqual([]);
  });
});

describe("commandFirstLine", () => {
  it("returns a one-line command as it is", () => {
    expect(commandFirstLine("ls -la")).toEqual({ line: "ls -la", hasMore: false });
  });

  it("returns the first line and says more follows", () => {
    expect(commandFirstLine("docker run \\\n  -p 3000:3000 app")).toEqual({
      line: "docker run \\",
      hasMore: true,
    });
  });

  it("skips leading blank lines and ignores trailing ones", () => {
    expect(commandFirstLine("\n\r\n  git status  \n\n")).toEqual({ line: "  git status", hasMore: false });
  });

  it("handles Windows line endings", () => {
    expect(commandFirstLine("a\r\nb")).toEqual({ line: "a", hasMore: true });
  });

  it("returns an empty line for empty content", () => {
    expect(commandFirstLine("")).toEqual({ line: "", hasMore: false });
  });
});

describe("clipCommand", () => {
  it("keeps a command under the cap whole", () => {
    expect(clipCommand("ls -la")).toEqual({ text: "ls -la", isCut: false });
  });

  it("keeps a command exactly at the cap whole", () => {
    const text = "a".repeat(MAX_COMMAND_CHARS);

    expect(clipCommand(text)).toEqual({ text, isCut: false });
  });

  it("cuts a command over the cap and says so", () => {
    const clipped = clipCommand("a".repeat(MAX_COMMAND_CHARS + 1));

    expect(clipped.text).toHaveLength(MAX_COMMAND_CHARS);
    expect(clipped.isCut).toBe(true);
  });
});
