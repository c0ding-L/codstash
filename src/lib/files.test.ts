import { describe, expect, it } from "vitest";

import {
  acceptAttribute,
  attachmentDisposition,
  buildFileKey,
  contentTypeFor,
  extensionOf,
  fromObjectMetadata,
  isOwnKey,
  toObjectMetadata,
  validateUpload,
} from "@/lib/files";

const MB = 1024 * 1024;
const UUID = "0f8fad5b-d9cb-469f-a165-70867728950e";

describe("extensionOf", () => {
  it.each([
    ["photo.PNG", "png"],
    ["archive.tar.gz", "gz"],
    ["README", ""],
    [".env", ""],
  ])("%s → %j", (name, extension) => {
    expect(extensionOf(name)).toBe(extension);
  });
});

describe("validateUpload", () => {
  const file = (name: string, size = 1000, type = "") => ({ name, size, type });

  it.each([
    ["image", "photo.png", "image/png", "image/png"],
    ["image", "photo.JPG", "image/jpeg", "image/jpeg"],
    ["image", "icon.svg", "image/svg+xml", "image/svg+xml"],
    ["file", "doc.pdf", "application/pdf", "application/pdf"],
    ["file", "config.yml", "text/yaml", "application/x-yaml"],
    ["file", "feed.xml", "text/xml", "application/xml"],
    ["file", "settings.ini", "text/plain", "text/plain"],
  ] as const)("accepts a %s named %s, stored as its extension's type", (kind, name, reported, stored) => {
    expect(validateUpload(kind, file(name, 1000, reported))).toEqual({ ok: true, contentType: stored });
  });

  it.each(["", "application/octet-stream"])(
    "accepts an allowed extension whatever the browser reports when it reports %j",
    (type) => {
      expect(validateUpload("file", file("notes.md", 1000, type))).toEqual({ ok: true, contentType: "text/markdown" });
    },
  );

  it("refuses an extension outside the kind's list", () => {
    expect(validateUpload("image", file("doc.pdf"))).toEqual({
      ok: false,
      error: "Images must be one of: .png, .jpg, .jpeg, .gif, .webp, .svg.",
    });
    expect(validateUpload("file", file("tool.exe"))).toMatchObject({ ok: false });
    expect(validateUpload("file", file("noextension"))).toMatchObject({ ok: false });
  });

  it("refuses a specific type that contradicts the extension", () => {
    expect(validateUpload("image", file("photo.png", 1000, "text/html"))).toEqual({
      ok: false,
      error: "The file's type does not match its extension.",
    });
  });

  it("caps images at 5 MB and files at 10 MB", () => {
    expect(validateUpload("image", file("a.png", 5 * MB))).toMatchObject({ ok: true });
    expect(validateUpload("image", file("a.png", 5 * MB + 1))).toEqual({ ok: false, error: "Images can be at most 5 MB." });
    expect(validateUpload("file", file("a.pdf", 10 * MB))).toMatchObject({ ok: true });
    expect(validateUpload("file", file("a.pdf", 10 * MB + 1))).toEqual({ ok: false, error: "Files can be at most 10 MB." });
  });

  it("refuses an empty file and a missing or overlong name", () => {
    expect(validateUpload("file", file("a.txt", 0))).toEqual({ ok: false, error: "The file is empty." });
    expect(validateUpload("file", file("  "))).toEqual({ ok: false, error: "The file has no name." });
    expect(validateUpload("file", file(`${"a".repeat(260)}.txt`))).toMatchObject({ ok: false });
  });
});

describe("acceptAttribute", () => {
  it("lists the extensions and the MIME types", () => {
    const accept = acceptAttribute("file").split(",");
    expect(accept).toContain(".toml");
    expect(accept).toContain("text/yaml");
    expect(accept).not.toContain(".png");
  });
});

describe("contentTypeFor", () => {
  it("serves by extension, and anything unknown as bytes", () => {
    expect(contentTypeFor("a.svg")).toBe("image/svg+xml");
    expect(contentTypeFor("a.toml")).toBe("application/toml");
    expect(contentTypeFor("a.html")).toBe("application/octet-stream");
  });
});

describe("buildFileKey and isOwnKey", () => {
  it("puts the upload under the user's folder, with a safe name", () => {
    expect(buildFileKey("user_1", "Mon rapport (final).pdf", UUID)).toBe(`user_1/${UUID}/Mon-rapport-final-.pdf`);
    expect(buildFileKey("user_1", "../../etc/passwd", UUID)).toBe(`user_1/${UUID}/etc-passwd`);
    expect(buildFileKey("user_1", "日本.png", UUID)).toBe(`user_1/${UUID}/png`);
  });

  it.each([
    "a.pdf",
    ".hidden.txt",
    "---.md",
    "日本.png",
    `${"x".repeat(50)}.${"y".repeat(95)}.txt`,
    `${"a".repeat(240)}.json`,
  ])("always builds a key that isOwnKey accepts, for %s", (name) => {
    expect(isOwnKey("user_1", buildFileKey("user_1", name))).toBe(true);
  });

  it("recognises only keys built for that user", () => {
    const key = buildFileKey("user_1", "a.pdf");
    expect(isOwnKey("user_1", key)).toBe(true);
    expect(isOwnKey("user_2", key)).toBe(false);
    expect(isOwnKey("user_1", `user_1/${UUID}/../x`)).toBe(false);
    expect(isOwnKey("user_1", `user_1/${UUID}/a/b.pdf`)).toBe(false);
    expect(isOwnKey("user_1", "user_1/not-a-uuid/a.pdf")).toBe(false);
  });
});

describe("attachmentDisposition", () => {
  it("always downloads, with an ASCII fallback and the real name encoded", () => {
    expect(attachmentDisposition('été "v2".pdf')).toBe(
      `attachment; filename="_t_ _v2_.pdf"; filename*=UTF-8''%C3%A9t%C3%A9%20%22v2%22.pdf`,
    );
  });
});

describe("object metadata", () => {
  it("round-trips the kind and a non-ASCII name", () => {
    const metadata = toObjectMetadata("image", " Photo été.png ");
    expect(Object.values(metadata).every((value) => /^[\x20-\x7e]*$/.test(value))).toBe(true);
    expect(fromObjectMetadata(metadata)).toEqual({ kind: "image", fileName: "Photo été.png" });
  });

  it("is null for metadata the upload route did not write", () => {
    expect(fromObjectMetadata(undefined)).toBeNull();
    expect(fromObjectMetadata({ kind: "video", name: "a" })).toBeNull();
    expect(fromObjectMetadata({ kind: "file", name: "%E0%A4%A" })).toBeNull();
  });
});
