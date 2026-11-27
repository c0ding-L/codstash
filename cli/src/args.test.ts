import { describe, expect, it } from "vitest";

import { parseCommand } from "./args";
import { UsageError } from "./errors";

describe("parseCommand", () => {
  it.each([
    [[], { name: "help", topic: undefined }],
    [["--help"], { name: "help", topic: undefined }],
    [["help", "run"], { name: "help", topic: "run" }],
    [["get", "--help"], { name: "help", topic: "get" }],
    [["--version"], { name: "version" }],
  ])("reads %j as help or version", (argv, expected) => {
    expect(parseCommand(argv)).toEqual(expected);
  });

  it("parses login with and without --url", () => {
    expect(parseCommand(["login"])).toEqual({ name: "login", url: undefined });
    expect(parseCommand(["login", "--url", " http://localhost:3000 "])).toEqual({ name: "login", url: "http://localhost:3000" });
  });

  it("parses logout and whoami", () => {
    expect(parseCommand(["logout"])).toEqual({ name: "logout" });
    expect(parseCommand(["whoami"])).toEqual({ name: "whoami" });
  });

  it("parses search, joining the words of the query", () => {
    expect(parseCommand(["search", "docker", "prune", "--type", "command", "--tag", "ops", "--limit", "5", "--json"])).toEqual({
      name: "search",
      query: "docker prune",
      type: "command",
      tag: "ops",
      limit: 5,
      json: true,
    });
  });

  it.each([["0"], ["-1"], ["two"], ["1.5"]])("refuses --limit %s", (limit) => {
    expect(() => parseCommand(["search", "x", "--limit", limit])).toThrow(UsageError);
  });

  it("parses get", () => {
    expect(parseCommand(["get", "abcd1234", "--copy"])).toEqual({ name: "get", id: "abcd1234", copy: true, raw: false });
    expect(parseCommand(["get", "abcd1234", "--raw"])).toEqual({ name: "get", id: "abcd1234", copy: false, raw: true });
  });

  it("parses run with -y and a query of several words", () => {
    expect(parseCommand(["run", "prune", "docker", "-y"])).toEqual({ name: "run", target: "prune docker", yes: true });
    expect(parseCommand(["run", "abcd1234"])).toEqual({ name: "run", target: "abcd1234", yes: false });
  });

  it("parses save, splitting the tags and defaulting the type to note", () => {
    expect(parseCommand(["save", "--title", "Prune", "--tags", "docker, ops,,", "--language", "bash", "cmd.sh"])).toEqual({
      name: "save",
      type: "note",
      title: "Prune",
      tags: ["docker", "ops"],
      language: "bash",
      file: "cmd.sh",
    });
    expect(parseCommand(["save", "--type", "command", "--title", "t"])).toMatchObject({ type: "command", tags: [], file: undefined });
  });

  it("requires save's --title", () => {
    expect(() => parseCommand(["save", "notes.md"])).toThrow("--title is required.");
    expect(() => parseCommand(["save", "--title", "  "])).toThrow("--title is required.");
  });

  it("parses context with -o", () => {
    expect(parseCommand(["context", "abcd1234", "-o", "CONTEXT.md"])).toEqual({ name: "context", id: "abcd1234", output: "CONTEXT.md" });
  });

  it("refuses an unknown command", () => {
    expect(() => parseCommand(["deploy"])).toThrow('Unknown command "deploy".');
  });

  it.each([
    [["get", "abcd1234", "--json"]],
    [["search", "x", "--yes"]],
    [["whoami", "--url", "x"]],
    [["run", "x", "--force"]],
  ])("refuses an unknown flag: %j", (argv) => {
    const error = (() => {
      try {
        parseCommand(argv);
      } catch (caught) {
        return caught;
      }
    })();
    expect(error).toBeInstanceOf(UsageError);
    expect((error as UsageError).message).toMatch(/^Unknown option/);
    expect((error as UsageError).command).toBe(argv[0]);
  });

  it("refuses missing and extra arguments", () => {
    expect(() => parseCommand(["get"])).toThrow("Missing argument.");
    expect(() => parseCommand(["get", "a", "b"])).toThrow('Unexpected argument "b".');
    expect(() => parseCommand(["logout", "now"])).toThrow('Unexpected argument "now".');
    expect(() => parseCommand(["search", " "])).toThrow("Missing argument.");
  });

  it("refuses a string flag given no value", () => {
    expect(() => parseCommand(["search", "x", "--type"])).toThrow(UsageError);
  });
});
