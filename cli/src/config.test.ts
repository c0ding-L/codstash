import { mkdtemp, readFile, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { configPath, readConfig, resolveConfig, writeConfig } from "./config";
import { DEFAULT_BASE_URL } from "./constants";

describe("configPath", () => {
  it("uses $XDG_CONFIG_HOME on Linux and macOS", () => {
    expect(configPath({ env: { XDG_CONFIG_HOME: "/xdg" }, platform: "linux", home: "/home/ada" })).toBe("/xdg/cortex/config.json");
    expect(configPath({ env: { XDG_CONFIG_HOME: "/xdg" }, platform: "darwin", home: "/Users/ada" })).toBe("/xdg/cortex/config.json");
  });

  it("falls back to ~/.config", () => {
    expect(configPath({ env: {}, platform: "linux", home: "/home/ada" })).toBe("/home/ada/.config/cortex/config.json");
    expect(configPath({ env: { XDG_CONFIG_HOME: "" }, platform: "darwin", home: "/Users/ada" })).toBe(
      "/Users/ada/.config/cortex/config.json",
    );
  });

  it("uses %APPDATA% on Windows, ignoring XDG", () => {
    expect(
      configPath({ env: { APPDATA: "C:\\Users\\ada\\AppData\\Roaming", XDG_CONFIG_HOME: "/xdg" }, platform: "win32", home: "C:\\Users\\ada" }),
    ).toBe("C:\\Users\\ada\\AppData\\Roaming\\cortex\\config.json");
  });

  it("falls back to the roaming folder under the home on Windows", () => {
    expect(configPath({ env: {}, platform: "win32", home: "C:\\Users\\ada" })).toBe(
      "C:\\Users\\ada\\AppData\\Roaming\\cortex\\config.json",
    );
  });
});

describe("resolveConfig", () => {
  it("uses the file", () => {
    expect(resolveConfig({ baseUrl: "https://a.test/", token: "cstash_file" }, {})).toEqual({
      baseUrl: "https://a.test",
      token: "cstash_file",
    });
  });

  it("lets CORTEX_URL and CORTEX_TOKEN override the file", () => {
    expect(
      resolveConfig({ baseUrl: "https://a.test", token: "cstash_file" }, { CORTEX_URL: "http://localhost:3000/", CORTEX_TOKEN: " cstash_env " }),
    ).toEqual({ baseUrl: "http://localhost:3000", token: "cstash_env" });
  });

  it("ignores blank env vars", () => {
    expect(resolveConfig({ baseUrl: "https://a.test", token: "cstash_file" }, { CORTEX_URL: "", CORTEX_TOKEN: " " })).toEqual({
      baseUrl: "https://a.test",
      token: "cstash_file",
    });
  });

  it("defaults to the production URL and no token", () => {
    expect(resolveConfig({}, {})).toEqual({ baseUrl: DEFAULT_BASE_URL });
  });
});

describe("readConfig / writeConfig", () => {
  let dir: string;
  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), "cortex-config-"));
  });
  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  it("reads {} when there is no file", async () => {
    expect(await readConfig(join(dir, "missing.json"))).toEqual({});
  });

  it("writes the file, creating its folder, and reads it back", async () => {
    const path = join(dir, "cortex", "config.json");
    await writeConfig({ baseUrl: "https://a.test", token: "cstash_x" }, path, "linux");
    expect(await readConfig(path)).toEqual({ baseUrl: "https://a.test", token: "cstash_x" });
    expect(JSON.parse(await readFile(path, "utf8"))).toEqual({ baseUrl: "https://a.test", token: "cstash_x" });
  });

  it.skipIf(process.platform === "win32")("makes the file readable by its owner only, even when it existed", async () => {
    const path = join(dir, "config.json");
    await writeFile(path, "{}", { mode: 0o644 });
    await writeConfig({ token: "cstash_x" }, path, process.platform);
    expect((await stat(path)).mode & 0o777).toBe(0o600);
  });

  it("drops fields that are not strings", async () => {
    const path = join(dir, "config.json");
    await writeFile(path, JSON.stringify({ baseUrl: 42, token: "cstash_x", extra: true }));
    expect(await readConfig(path)).toEqual({ token: "cstash_x" });
  });
});
