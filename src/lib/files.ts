/**
 * Upload rules for file and image items, shared by the browser (to refuse early)
 * and the server (to refuse for real). The extension is the authority: browsers
 * often send an empty or generic MIME type for `.md`, `.toml`, `.yaml` or `.ini`,
 * so the type the browser reports is only checked when it says something specific.
 */

export type UploadKind = "file" | "image";

const MB = 1024 * 1024;

/** Extension → the content type the file is stored and served with. */
const IMAGE_TYPES: Record<string, string> = {
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  gif: "image/gif",
  webp: "image/webp",
  svg: "image/svg+xml",
};

const FILE_TYPES: Record<string, string> = {
  pdf: "application/pdf",
  txt: "text/plain",
  md: "text/markdown",
  json: "application/json",
  yaml: "application/x-yaml",
  yml: "application/x-yaml",
  xml: "application/xml",
  csv: "text/csv",
  toml: "application/toml",
  ini: "text/plain",
};

/** The kinds the file list names, each a key of the `fileKinds` messages; "file" when unknown. */
export type FileKind = "pdf" | "text" | "markdown" | "json" | "yaml" | "xml" | "csv" | "toml" | "ini" | "file";

/** What the file list calls each allowed file extension. */
const FILE_KINDS: Record<string, Exclude<FileKind, "file">> = {
  pdf: "pdf",
  txt: "text",
  md: "markdown",
  json: "json",
  yaml: "yaml",
  yml: "yaml",
  xml: "xml",
  csv: "csv",
  toml: "toml",
  ini: "ini",
};

/** MIME types a browser may report for an allowed file, on top of the stored ones. */
const EXTRA_FILE_MIMES = ["text/yaml", "text/xml"];

/** Types that say nothing about the file, so they are not held against it. */
const GENERIC_MIMES = new Set(["", "application/octet-stream"]);

export const UPLOAD_RULES: Record<UploadKind, { maxBytes: number; types: Record<string, string> }> = {
  image: { maxBytes: 5 * MB, types: IMAGE_TYPES },
  file: { maxBytes: 10 * MB, types: FILE_TYPES },
};

/** The longest original file name kept. */
export const MAX_FILE_NAME_LENGTH = 255;

export function isUploadKind(value: unknown): value is UploadKind {
  return value === "file" || value === "image";
}

/** The extension, lowercased and without the dot; "" when there is none. */
export function extensionOf(fileName: string) {
  const dot = fileName.lastIndexOf(".");
  return dot > 0 ? fileName.slice(dot + 1).toLowerCase() : "";
}

/** The file's kind, from its extension; "file" when unknown. The UI words it per language. */
export function fileKind(fileName: string): FileKind {
  return Object.hasOwn(FILE_KINDS, extensionOf(fileName)) ? FILE_KINDS[extensionOf(fileName)]! : "file";
}

function acceptedMimes(kind: UploadKind) {
  const stored = Object.values(UPLOAD_RULES[kind].types);
  return new Set(kind === "file" ? [...stored, ...EXTRA_FILE_MIMES] : stored);
}

/** The extensions, as listed to the user: ".png, .jpg, …". */
export function allowedExtensions(kind: UploadKind) {
  return Object.keys(UPLOAD_RULES[kind].types).map((extension) => `.${extension}`);
}

/** The `accept` attribute of a file input for this kind. */
export function acceptAttribute(kind: UploadKind) {
  return [...allowedExtensions(kind), ...acceptedMimes(kind)].join(",");
}

/**
 * Why a file was refused, as a key of the `errors.upload` messages and its values. This runs in
 * the browser and on the server, so each side words it in its own language.
 */
export type UploadError =
  | { key: "noName" | "typeMismatch" | "empty"; values?: undefined }
  | { key: "nameTooLong" | "imageTooLarge" | "fileTooLarge"; values: { max: number } }
  | { key: "imageExtension" | "fileExtension"; values: { extensions: string } };

export type UploadCheck = { ok: true; contentType: string } | { ok: false; error: UploadError };

/** Whether a file can be uploaded as this kind, and the content type to store it with. */
export function validateUpload(kind: UploadKind, file: { name: string; size: number; type: string }): UploadCheck {
  const rules = UPLOAD_RULES[kind];
  const name = file.name.trim();

  if (!name) return { ok: false, error: { key: "noName" } };
  if (name.length > MAX_FILE_NAME_LENGTH) {
    return { ok: false, error: { key: "nameTooLong", values: { max: MAX_FILE_NAME_LENGTH } } };
  }

  const contentType = rules.types[extensionOf(name)];
  if (!contentType) {
    return {
      ok: false,
      error: { key: `${kind}Extension`, values: { extensions: allowedExtensions(kind).join(", ") } },
    };
  }

  const reported = file.type.toLowerCase();
  if (!GENERIC_MIMES.has(reported) && !acceptedMimes(kind).has(reported)) {
    return { ok: false, error: { key: "typeMismatch" } };
  }

  if (file.size <= 0) return { ok: false, error: { key: "empty" } };
  if (file.size > rules.maxBytes) {
    return { ok: false, error: { key: `${kind}TooLarge`, values: { max: rules.maxBytes / MB } } };
  }

  return { ok: true, contentType };
}

/** The content type to serve a stored file with, from its name. */
export function contentTypeFor(fileName: string) {
  const extension = extensionOf(fileName);
  return IMAGE_TYPES[extension] ?? FILE_TYPES[extension] ?? "application/octet-stream";
}

/**
 * Where an upload is stored: `<userId>/<random id>/<safe name>`. The prefix is what
 * `isOwnKey` checks, so a user can only attach their own uploads to an item.
 */
export function buildFileKey(userId: string, fileName: string, id: string = crypto.randomUUID()) {
  const safe =
    fileName
      .trim()
      .replace(/[^A-Za-z0-9._-]+/g, "-")
      // Cut before stripping, so the cut cannot leave a leading dot that `isOwnKey` refuses.
      .slice(-100)
      .replace(/^[-.]+/, "") || "file";
  return `${userId}/${id}/${safe}`;
}

/** Whether a key, as sent back by the browser, is one `buildFileKey` made for this user. */
export function isOwnKey(userId: string, key: string) {
  const parts = key.split("/");
  return (
    parts.length === 3 &&
    parts[0] === userId &&
    /^[0-9a-f-]{36}$/.test(parts[1]!) &&
    /^[A-Za-z0-9_-][A-Za-z0-9._-]*$/.test(parts[2]!)
  );
}

/**
 * A `Content-Disposition` header that always downloads. A header value must be ASCII, so the
 * plain `filename` is a fallback with accents removed and anything else replaced, quotes and
 * backslashes included; `filename*` carries the real name, encoded as RFC 5987 asks.
 */
export function attachmentDisposition(fileName: string) {
  const fallback = fileName
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\x20-\x7e]|["\\]/gu, "_");
  const encoded = encodeURIComponent(fileName).replace(/['()*!]/g, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`);
  return `attachment; filename="${fallback}"; filename*=UTF-8''${encoded}`;
}

/**
 * Object metadata must be ASCII, so the original name is stored URI-encoded.
 * The kind is stored too, so an image upload cannot become a file item.
 */
export function toObjectMetadata(kind: UploadKind, fileName: string): Record<string, string> {
  return { kind, name: encodeURIComponent(fileName.trim()) };
}

export function fromObjectMetadata(metadata: Record<string, string> | undefined) {
  if (!metadata || !isUploadKind(metadata.kind) || !metadata.name) return null;
  try {
    return { kind: metadata.kind, fileName: decodeURIComponent(metadata.name) };
  } catch {
    return null;
  }
}
