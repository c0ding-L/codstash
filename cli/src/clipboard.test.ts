import { describe, expect, it } from "vitest";

import { clipboardInput, clipboardTools } from "./clipboard";

describe("clipboard", () => {
  it("tries the platform's tools in order, WSL's clip.exe last on Linux", () => {
    expect(clipboardTools("darwin").map(([command]) => command)).toEqual(["pbcopy"]);
    expect(clipboardTools("win32").map(([command]) => command)).toEqual(["clip.exe"]);
    expect(clipboardTools("linux")).toEqual([
      ["wl-copy", []],
      ["xclip", ["-selection", "clipboard"]],
      ["clip.exe", []],
    ]);
  });

  it("sends clip.exe UTF-16LE without a byte-order mark, so accents survive", () => {
    expect(clipboardInput("clip.exe", "Café ›")).toEqual(Buffer.from("Café ›", "utf16le"));
    expect(clipboardInput("clip.exe", "a")).toEqual(Buffer.from([0x61, 0x00]));
  });

  it("sends the other tools UTF-8", () => {
    expect(clipboardInput("pbcopy", "Café")).toEqual(Buffer.from("Café", "utf8"));
  });
});
