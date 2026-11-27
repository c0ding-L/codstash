import { spawn } from "node:child_process";

import { CliError } from "./errors";

type Tool = [command: string, args: string[]];

/** The clipboard tools to try, in order. On Linux, `clip.exe` is WSL's way to the Windows clipboard. */
export function clipboardTools(platform: NodeJS.Platform): Tool[] {
  if (platform === "darwin") return [["pbcopy", []]];
  if (platform === "win32") return [["clip.exe", []]];
  return [
    ["wl-copy", []],
    ["xclip", ["-selection", "clipboard"]],
    ["clip.exe", []],
  ];
}

/**
 * The bytes to pipe to the tool. `clip.exe` reads UTF-8 in the console's code page, which garbles
 * accents; it detects UTF-16LE and takes it as is. No byte-order mark: it would be pasted too.
 */
export function clipboardInput(command: string, text: string): Buffer {
  if (command === "clip.exe") return Buffer.from(text, "utf16le");
  return Buffer.from(text, "utf8");
}

/** True when the tool took the text; false when it is missing or failed (xclip with no display). */
function tryTool([command, args]: Tool, text: string): Promise<boolean> {
  return new Promise((resolve) => {
    const child = spawn(command, args, { stdio: ["pipe", "ignore", "ignore"] });
    child.on("error", () => resolve(false));
    child.on("close", (code) => resolve(code === 0));
    child.stdin.on("error", () => {});
    child.stdin.end(clipboardInput(command, text));
  });
}

export async function copyToClipboard(text: string, platform: NodeJS.Platform = process.platform) {
  const tools = clipboardTools(platform);
  for (const tool of tools) {
    if (await tryTool(tool, text)) return;
  }
  throw new CliError(
    "No clipboard tool worked.",
    `Install one of: ${tools.map(([command]) => command).join(", ")}. Or drop --copy and pipe the output.`,
  );
}
