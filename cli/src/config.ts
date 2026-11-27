import { chmod, mkdir, readFile, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { dirname, posix, win32 } from "node:path";

import { DEFAULT_BASE_URL } from "./constants";

export interface StoredConfig {
  baseUrl?: string;
  token?: string;
}

/** What a command uses: the file, with `CORTEX_URL` and `CORTEX_TOKEN` on top. */
export interface Config {
  baseUrl: string;
  token?: string;
}

export interface ConfigEnv {
  env: NodeJS.ProcessEnv;
  platform: NodeJS.Platform;
  home: string;
}

const defaultEnv = (): ConfigEnv => ({ env: process.env, platform: process.platform, home: homedir() });

/**
 * `%APPDATA%\cortex\config.json` on Windows, else `$XDG_CONFIG_HOME/cortex/config.json`, else
 * `~/.config/cortex/config.json`.
 */
export function configPath({ env, platform, home }: ConfigEnv = defaultEnv()): string {
  if (platform === "win32") {
    return win32.join(env.APPDATA || win32.join(home, "AppData", "Roaming"), "cortex", "config.json");
  }
  return posix.join(env.XDG_CONFIG_HOME || posix.join(home, ".config"), "cortex", "config.json");
}

/** The file's content, or `{}` when there is no file yet. A broken file is an error, not a silent reset. */
export async function readConfig(path = configPath()): Promise<StoredConfig> {
  let text: string;
  try {
    text = await readFile(path, "utf8");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return {};
    throw error;
  }
  const parsed: unknown = JSON.parse(text);
  if (typeof parsed !== "object" || parsed === null) return {};
  const { baseUrl, token } = parsed as Record<string, unknown>;
  return {
    ...(typeof baseUrl === "string" && { baseUrl }),
    ...(typeof token === "string" && { token }),
  };
}

/** Writes the file, readable by its owner only on POSIX: it holds a token. */
export async function writeConfig(config: StoredConfig, path = configPath(), platform = process.platform) {
  await mkdir(dirname(path), { recursive: true, mode: 0o700 });
  await writeFile(path, `${JSON.stringify(config, null, 2)}\n`, { mode: 0o600 });
  // `mode` only applies when the file is created; an older file keeps its own.
  if (platform !== "win32") await chmod(path, 0o600);
}

export function trimUrl(url: string) {
  return url.trim().replace(/\/+$/, "");
}

/** The file's values under the env overrides, with the production URL as the last fallback. */
export function resolveConfig(stored: StoredConfig, env: NodeJS.ProcessEnv = process.env): Config {
  const baseUrl = trimUrl(env.CORTEX_URL || stored.baseUrl || DEFAULT_BASE_URL);
  const token = env.CORTEX_TOKEN?.trim() || stored.token;
  return { baseUrl, ...(token && { token }) };
}
