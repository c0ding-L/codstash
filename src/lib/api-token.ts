// Personal API tokens (C1): their format, hash and the bearer header. Pure, but server-only
// in practice since it uses node:crypto.

import { createHash, randomBytes } from "node:crypto";

const TOKEN_PREFIX = "cstash_";
/** 32 random bytes are 43 characters of unpadded base64url. */
const TOKEN_BYTES = 32;
export const API_TOKEN_LENGTH = TOKEN_PREFIX.length + 43;
/** "cstash_" plus 5 characters: shown in the list to tell tokens apart. */
export const API_TOKEN_PREFIX_LENGTH = 12;

const TOKEN_PATTERN = /^cstash_[A-Za-z0-9_-]{43}$/;

export interface GeneratedToken {
  /** Shown to the user once, never stored. */
  token: string;
  prefix: string;
  hash: string;
}

/** SHA-256 in hex. A plain hash is enough for a 256-bit random token; bcrypt would add nothing. */
export function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export function generateToken(): GeneratedToken {
  const token = TOKEN_PREFIX + randomBytes(TOKEN_BYTES).toString("base64url");
  return { token, prefix: token.slice(0, API_TOKEN_PREFIX_LENGTH), hash: hashToken(token) };
}

/** The token of an `Authorization: Bearer cstash_…` header, or null when it is missing or malformed. */
export function parseBearer(header: string | null | undefined): string | null {
  const match = /^Bearer +(\S+)$/i.exec(header?.trim() ?? "");
  if (!match) return null;
  return TOKEN_PATTERN.test(match[1]) ? match[1] : null;
}
