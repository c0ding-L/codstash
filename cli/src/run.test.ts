import { EventEmitter } from "node:events";

import { beforeEach, describe, expect, it, vi } from "vitest";

import { ApiClient, type ApiItem } from "./api";
import { runCommand, spawnInShell, userShell, type RunDeps } from "./run";

const spawnMock = vi.hoisted(() => vi.fn());
vi.mock("node:child_process", () => ({ spawn: spawnMock }));

const ID = "cmabcdefgh0000000wxyz1234";

function command(content: string, overrides: Partial<ApiItem> = {}): ApiItem {
  return {
    id: ID,
    title: "Deploy",
    description: null,
    type: { id: "t1", slug: "command", name: "Command", isSystem: true },
    content,
    url: null,
    language: "bash",
    tags: [],
    collections: [],
    ...overrides,
  };
}

/** Deps around a client stubbed to return `items` for every lookup, and answers given in order. */
function deps(items: ApiItem[], answers: string[], overrides: Partial<RunDeps> = {}) {
  const client = new ApiClient("https://cortex.test", "cstash_x", vi.fn<typeof fetch>());
  vi.spyOn(client, "listItems").mockResolvedValue(items);
  vi.spyOn(client, "getItem").mockImplementation(async (id) => items.find((item) => item.id === id)!);
  const ask = vi.fn(async (_question: string) => answers.shift() ?? "");
  const spawnCommand = vi.fn(async (_command: string) => 0);
  const releaseInput = vi.fn();
  const said: string[] = [];
  const result: RunDeps = {
    client,
    ask,
    spawnCommand,
    releaseInput,
    say: (line) => said.push(line),
    interactive: true,
    ...overrides,
  };
  return { deps: result, ask, spawnCommand, releaseInput, said, client };
}

describe("runCommand", () => {
  it("fills the variables, shows the command and runs it once confirmed", async () => {
    const { deps: d, ask, spawnCommand, said } = deps([command("kubectl rollout restart deploy/{{app}} -n {{ns:prod}}")], [
      "api",
      "",
      "y",
    ]);

    expect(await runCommand("wxyz1234", { yes: false }, d)).toBe(0);
    expect(ask.mock.calls.map(([question]) => question)).toEqual(["app: ", "ns [prod]: ", "Run? [y/N] "]);
    expect(said).toContain("  kubectl rollout restart deploy/api -n prod");
    expect(spawnCommand).toHaveBeenCalledWith("kubectl rollout restart deploy/api -n prod");
  });

  it("lets go of stdin before the command starts, so it can read the terminal", async () => {
    const { deps: d, spawnCommand, releaseInput } = deps([command("read -p 'name: ' n")], ["y"]);
    await runCommand("wxyz1234", { yes: false }, d);
    expect(releaseInput).toHaveBeenCalledOnce();
    expect(releaseInput.mock.invocationCallOrder[0]).toBeLessThan(spawnCommand.mock.invocationCallOrder[0]!);
  });

  it.each([[""], ["n"], ["no"], ["yy"]])("does not run on the answer %j", async (answer) => {
    const { deps: d, spawnCommand, said } = deps([command("rm -rf ./build")], [answer]);
    expect(await runCommand("wxyz1234", { yes: false }, d)).toBe(1);
    expect(spawnCommand).not.toHaveBeenCalled();
    expect(said).toContain("Not run.");
  });

  it("skips the question with --yes", async () => {
    const { deps: d, ask, spawnCommand } = deps([command("make deploy")], []);
    expect(await runCommand("wxyz1234", { yes: true }, d)).toBe(0);
    expect(ask).not.toHaveBeenCalled();
    expect(spawnCommand).toHaveBeenCalledWith("make deploy");
  });

  it("propagates the command's exit code", async () => {
    const { deps: d, spawnCommand } = deps([command("false")], ["y"]);
    spawnCommand.mockResolvedValue(3);
    expect(await runCommand("wxyz1234", { yes: false }, d)).toBe(3);
  });

  it("refuses to run without a terminal unless --yes, and then takes the defaults", async () => {
    const quiet = deps([command("echo {{who:world}}")], [], { interactive: false });
    await expect(runCommand("wxyz1234", { yes: false }, quiet.deps)).rejects.toThrow(/needs a terminal/);
    expect(quiet.spawnCommand).not.toHaveBeenCalled();

    const forced = deps([command("echo {{who:world}}")], [], { interactive: false });
    expect(await runCommand("wxyz1234", { yes: true }, forced.deps)).toBe(0);
    expect(forced.ask).not.toHaveBeenCalled();
    expect(forced.spawnCommand).toHaveBeenCalledWith("echo world");
  });

  it("refuses an item that is not a command", async () => {
    const { deps: d, spawnCommand } = deps(
      [command("hello", { type: { id: "t2", slug: "note", name: "Note", isSystem: true }, title: "Notes" })],
      ["y"],
    );
    await expect(runCommand("wxyz1234", { yes: false }, d)).rejects.toThrow('"Notes" is a note, not a command.');
    expect(spawnCommand).not.toHaveBeenCalled();
  });

  it("searches the commands for a query and offers a numbered pick", async () => {
    const first = command("docker compose up", { id: "cm00000000000000000000001", title: "Up" });
    const second = command("docker compose down", { id: "cm00000000000000000000002", title: "Down" });
    const { deps: d, client, spawnCommand, said } = deps([first, second], ["2", "y"]);

    expect(await runCommand("docker compose", { yes: false }, d)).toBe(0);
    expect(client.listItems).toHaveBeenCalledWith({ q: "docker compose", type: "command", limit: 20 });
    expect(said).toContain("   2) 00000002  Down");
    expect(spawnCommand).toHaveBeenCalledWith("docker compose down");
  });

  it("errors on an invalid pick", async () => {
    const items = [command("a", { id: "cm00000000000000000000001" }), command("b", { id: "cm00000000000000000000002" })];
    const { deps: d, spawnCommand } = deps(items, ["7"]);
    await expect(runCommand("two words", { yes: false }, d)).rejects.toThrow("No command picked.");
    expect(spawnCommand).not.toHaveBeenCalled();
  });

  it("errors when nothing matches", async () => {
    const { deps: d } = deps([], []);
    await expect(runCommand("nothing here", { yes: false }, d)).rejects.toThrow('No command matches "nothing here".');
  });
});

describe("spawnInShell", () => {
  beforeEach(() => {
    spawnMock.mockImplementation(() => new EventEmitter());
  });

  function lastChild() {
    return spawnMock.mock.results.at(-1)!.value as EventEmitter;
  }

  it("runs the command in $SHELL with stdio inherited and resolves with its exit code", async () => {
    const done = spawnInShell("make test", "linux", { SHELL: "/bin/zsh" });
    lastChild().emit("close", 2, null);
    expect(await done).toBe(2);
    expect(spawnMock).toHaveBeenCalledWith("make test", { shell: "/bin/zsh", stdio: "inherit" });
  });

  it("gives 128 + the signal's number when the command is killed", async () => {
    const done = spawnInShell("sleep 9", "linux", {});
    lastChild().emit("close", null, "SIGINT");
    expect(await done).toBe(130);
  });

  it("uses cmd on Windows", () => {
    expect(userShell("win32", { ComSpec: "C:\\Windows\\system32\\cmd.exe", SHELL: "/bin/bash" })).toBe("C:\\Windows\\system32\\cmd.exe");
    expect(userShell("win32", {})).toBe("cmd.exe");
    expect(userShell("linux", {})).toBe("/bin/sh");
  });

  it("rejects when the shell cannot start", async () => {
    const done = spawnInShell("x", "linux", { SHELL: "/nope" });
    lastChild().emit("error", new Error("spawn /nope ENOENT"));
    await expect(done).rejects.toThrow("Could not start the shell: spawn /nope ENOENT");
  });
});
