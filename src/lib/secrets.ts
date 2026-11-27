import { ITEM_LIMITS } from "@/lib/item-limits";

/**
 * Finds what looks like a secret (an API key, a token, a private key, a password) in text, from
 * known shapes. Pure and client-safe: the item forms warn with it before a save or an AI call,
 * and the server will use `containsSecrets` to keep such items out of public pages. Not a
 * guarantee: a secret of an unknown shape goes unseen.
 */

export type SecretKind =
  | "privateKey"
  | "aws"
  | "github"
  | "openai"
  | "anthropic"
  | "openrouter"
  | "stripe"
  | "slack"
  | "google"
  | "codstash"
  | "jwt"
  | "connectionString"
  | "envAssignment";

export interface SecretFinding {
  kind: SecretKind;
  /** 1-based. */
  line: number;
  /** The first 4 characters of the match, then `…`: never the whole value. */
  preview: string;
}

export type ItemField = "title" | "description" | "content" | "url";

export interface ItemSecretFinding extends SecretFinding {
  field: ItemField;
}

export interface ScannableItem {
  title?: string | null;
  description?: string | null;
  content?: string | null;
  url?: string | null;
}

interface Candidate {
  kind: SecretKind;
  start: number;
  end: number;
  /** What the match is shown as, masked. */
  text: string;
  /** The secret part, checked against the placeholders; null when the match needs no check. */
  value: string | null;
}

interface Detector {
  /** Global; tried on one line at a time. */
  pattern: RegExp;
  /** Turns a match into a finding, or null when it is not one (a placeholder, a bad shape). */
  read: (match: RegExpExecArray) => Omit<Candidate, "start" | "end"> | null;
}

/*
 * Linear time: every pattern either has a fixed length, or ends on a greedy run with nothing
 * after it that could fail and backtrack across the line. Where the spec's shape needs more
 * (a JWT's dots, a URL's `user:pass@`, an env name holding a keyword), the run is matched whole
 * and checked in code, so a long line of near-misses is read once.
 */
const DETECTORS: Detector[] = [
  {
    pattern: /-----BEGIN (?:RSA |EC |OPENSSH |DSA |PGP )?PRIVATE KEY-----/g,
    read: (m) => ({ kind: "privateKey", text: m[0], value: null }),
  },
  {
    pattern: /\b(?:AKIA|ASIA)([0-9A-Z]{16})\b/g,
    read: (m) => ({ kind: "aws", text: m[0], value: m[1] }),
  },
  {
    pattern: /\bgh[pousr]_([A-Za-z0-9]{36,})\b/g,
    read: (m) => ({ kind: "github", text: m[0], value: m[1] }),
  },
  {
    pattern: /\bgithub_pat_([A-Za-z0-9_]{50,})\b/g,
    read: (m) => ({ kind: "github", text: m[0], value: m[1] }),
  },
  {
    pattern: /\bsk-(proj-|ant-|or-v1-)?([A-Za-z0-9_-]{20,})\b/g,
    read: (m) => {
      // Fewer than 20 real characters, once the x's and dots of a placeholder are left out.
      if (m[2].replace(/[xX*.\-_]/g, "").length < 20) return null;
      // A real key always holds digits; `sk-learn-preprocessing-pipeline` is a name, not a key.
      if (!/[0-9]/.test(m[2])) return null;
      const kind = m[1] === "ant-" ? "anthropic" : m[1] === "or-v1-" ? "openrouter" : "openai";
      return { kind, text: m[0], value: m[2] };
    },
  },
  {
    pattern: /\b(?:sk|rk)_(?:live|test)_([A-Za-z0-9]{20,})\b/g,
    read: (m) => ({ kind: "stripe", text: m[0], value: m[1] }),
  },
  {
    pattern: /\bxox[abprs]-([A-Za-z0-9-]{10,})\b/g,
    read: (m) => ({ kind: "slack", text: m[0], value: m[1] }),
  },
  {
    pattern: /\bAIza([0-9A-Za-z_-]{35})(?![0-9A-Za-z_-])/g,
    read: (m) => ({ kind: "google", text: m[0], value: m[1] }),
  },
  {
    // Our own API token (C1). Its last character is never `-` or `_` (32 bytes of base64url),
    // so `\b` is safe here.
    pattern: /\bcstash_([A-Za-z0-9_-]{43})\b/g,
    read: (m) => ({ kind: "codstash", text: m[0], value: m[1] }),
  },
  {
    // Three dot-separated base64url parts of 10+ characters, the first one a JSON header.
    pattern: /\beyJ[A-Za-z0-9_.-]*/g,
    read: (m) => {
      const parts = m[0].split(".");
      const shaped = parts.length >= 3 && parts[0].length >= 13 && parts[1].length >= 10 && parts[2].length >= 10;
      return shaped ? { kind: "jwt", text: m[0], value: m[0] } : null;
    },
  },
  {
    pattern: /\b(?:postgres(?:ql)?|mysql|mongodb(?:\+srv)?|redis):\/\/\S*/g,
    read: (m) => {
      // The password stops at `/`, which keeps the check to one pass. A URL's password is
      // percent-encoded (`%2F`), so a raw `/` in it is a known gap: that URL is not reported.
      const credentials = /^[a-z+]+:\/\/[^:\s/@]+:([^@\s/]+)@/i.exec(m[0]);
      if (!credentials) return null;
      // `user:password@` is the tutorial's literal, not a password.
      if (credentials[1].toLowerCase() === "password") return null;
      return { kind: "connectionString", text: m[0], value: credentials[1] };
    },
  },
  {
    pattern: /^\s*(?:export\s+)?([A-Z0-9_]+)\s*=\s*(\S*)/g,
    read: (m) => {
      if (!/SECRET|TOKEN|PASSWORD|PASSWD|API_KEY|PRIVATE_KEY/.test(m[1])) return null;
      const value = m[2].replace(/^["']|["']$/g, "");
      if (value.length < 8) return null;
      return { kind: "envAssignment", text: `${m[1]}=${m[2]}`, value };
    },
  },
];

const PLACEHOLDER_WORDS = /your|example|changeme|placeholder|dummy|fake/i;
const TEMPLATE_SYNTAX = /<[^<>]*>|\$\{[^}]*\}|\{\{[^}]*\}\}/;

/** A tutorial's stand-in: only x's, stars or dots, a `<...>` / `${...}` / `{{...}}`, or a telling word. */
function isPlaceholder(value: string): boolean {
  return /^[xX*.]+$/.test(value) || TEMPLATE_SYNTAX.test(value) || PLACEHOLDER_WORDS.test(value);
}

/** The first 4 characters, then `…`. */
function maskSecret(text: string): string {
  return `${text.slice(0, 4)}…`;
}

function scanLine(line: string): Candidate[] {
  const found: Candidate[] = [];
  for (const { pattern, read } of DETECTORS) {
    pattern.lastIndex = 0;
    for (let match = pattern.exec(line); match; match = pattern.exec(line)) {
      // An empty match (the env pattern on a blank line) would not move on.
      if (match[0] === "") pattern.lastIndex++;
      const candidate = read(match);
      if (!candidate || (candidate.value !== null && isPlaceholder(candidate.value))) continue;
      const start = match.index;
      const end = start + match[0].length;
      // One finding per secret: `OPENAI_API_KEY=sk-…` is the key, not also an env line.
      const overlaps = found.some((other) => start < other.end && other.start < end);
      if (!overlaps) found.push({ ...candidate, start, end });
    }
  }
  return found.sort((a, b) => a.start - b.start);
}

/** Every secret-like value in the text, in reading order. Text past the content cap is not read. */
export function detectSecrets(text: string): SecretFinding[] {
  const lines = text.slice(0, ITEM_LIMITS.content).split("\n");
  return lines.flatMap((line, index) =>
    scanLine(line).map(({ kind, text: match }) => ({ kind, line: index + 1, preview: maskSecret(match) })),
  );
}

const FIELDS: ItemField[] = ["title", "description", "content", "url"];

/** Scans every field the item has, the URL included: tokens ride in query strings. */
export function scanItem(item: ScannableItem): ItemSecretFinding[] {
  return FIELDS.flatMap((field) => {
    const text = item[field];
    return text ? detectSecrets(text).map((finding) => ({ ...finding, field })) : [];
  });
}

/** For the server: whether the item holds anything that looks like a secret. */
export function containsSecrets(item: ScannableItem): boolean {
  return scanItem(item).length > 0;
}
