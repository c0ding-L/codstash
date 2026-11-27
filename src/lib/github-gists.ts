// GitHub Gists for import (A4): public gists only, read with the user's OAuth token when they
// linked GitHub (5,000 requests/h), unauthenticated otherwise (60/h per IP). Server-only: the
// token never reaches the browser.

import type { GistDetail } from "@/lib/import";
import { ITEM_LIMITS } from "@/lib/item-limits";

const API = "https://api.github.com";
/** The only host a truncated file's `raw_url` may point at: no SSRF through a crafted gist. */
const RAW_HOST = "gist.githubusercontent.com";
const TIMEOUT_MS = 10_000;
/** Listing pages of 100; a stash of more than 1,000 gists lists the newest 1,000. */
const MAX_LIST_PAGES = 10;
/**
 * The most an API answer is read: a gist inlines up to 1 MB per file and can hold hundreds of
 * files. A larger answer counts as a failed fetch rather than being held in memory.
 */
const MAX_API_BYTES = 10_000_000;

/** Files and characters one gist import may still read: shared by every gist of the request. */
export interface GistBudget {
  files: number;
  chars: number;
  /** Files left out because the budget ran out. */
  skipped: number;
}

/** What one request may read: about what the batch route takes (`IMPORT_BODY_MAX_BYTES`). */
export function newGistBudget(): GistBudget {
  return { files: 500, chars: 4_000_000, skipped: 0 };
}

/** GitHub's own username rule: letters, digits and single inner hyphens, at most 39 characters. */
const USERNAME = /^[A-Za-z0-9](?:[A-Za-z0-9]|-(?=[A-Za-z0-9])){0,38}$/;
const GIST_ID = /^[0-9a-f]{1,64}$/i;

export function isGithubUsername(value: string): boolean {
  return USERNAME.test(value);
}

export function isGistId(value: string): boolean {
  return GIST_ID.test(value);
}

export type GithubErrorKind = "rateLimit" | "notFound" | "failed" | "badUrl";

export class GithubError extends Error {
  constructor(readonly kind: GithubErrorKind) {
    super(`GitHub request failed: ${kind}`);
    this.name = "GithubError";
  }
}

export interface GistSummary {
  id: string;
  description: string | null;
  files: string[];
  updatedAt: string;
}

function apiHeaders(token: string | null): HeadersInit {
  return {
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
    // GitHub refuses requests without one. Generic: nothing about the user.
    "User-Agent": "codstash-import",
    ...(token && { Authorization: `Bearer ${token}` }),
  };
}

/**
 * A GET on the GitHub API. A token GitHub refuses (401: revoked) is dropped and the call made
 * again unauthenticated. 403 and 429 are the rate limit.
 */
async function githubGet(path: string, token: string | null): Promise<unknown> {
  let response: Response;
  try {
    response = await fetch(`${API}${path}`, {
      headers: apiHeaders(token),
      cache: "no-store",
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch {
    throw new GithubError("failed");
  }
  if (response.status === 401 && token) return githubGet(path, null);
  if (response.status === 403 || response.status === 429) throw new GithubError("rateLimit");
  if (response.status === 404) throw new GithubError("notFound");
  if (!response.ok) throw new GithubError("failed");
  try {
    return JSON.parse(await readTextWithin(response, MAX_API_BYTES));
  } catch {
    throw new GithubError("failed");
  }
}

/** The body as text, failing past `maxBytes` (declared or streamed) instead of reading on. */
async function readTextWithin(response: Response, maxBytes: number): Promise<string> {
  if (Number(response.headers.get("content-length")) > maxBytes || !response.body) {
    throw new GithubError("failed");
  }
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let text = "";
  let received = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    received += value.byteLength;
    if (received > maxBytes) {
      await reader.cancel();
      throw new GithubError("failed");
    }
    text += decoder.decode(value, { stream: true });
  }
  return text + decoder.decode();
}

/** The login of the token's GitHub account, or null when GitHub does not answer with one. */
export async function getGithubLogin(token: string): Promise<string | null> {
  try {
    const user = (await githubGet("/user", token)) as { login?: unknown } | null;
    return typeof user?.login === "string" && isGithubUsername(user.login) ? user.login : null;
  } catch {
    return null;
  }
}

interface ApiGist {
  id?: unknown;
  public?: unknown;
  description?: unknown;
  updated_at?: unknown;
  files?: Record<string, { filename?: unknown; language?: unknown; content?: unknown; truncated?: unknown; raw_url?: unknown } | null>;
}

/** The user's public gists, newest first. `username` must pass `isGithubUsername`. */
export async function listPublicGists(username: string, token: string | null): Promise<GistSummary[]> {
  if (!isGithubUsername(username)) throw new GithubError("notFound");
  const gists: GistSummary[] = [];
  for (let page = 1; page <= MAX_LIST_PAGES; page++) {
    const batch = (await githubGet(`/users/${username}/gists?per_page=100&page=${page}`, token)) as ApiGist[];
    if (!Array.isArray(batch)) throw new GithubError("failed");
    for (const gist of batch) {
      if (gist.public !== true || typeof gist.id !== "string" || !isGistId(gist.id)) continue;
      gists.push({
        id: gist.id,
        description: typeof gist.description === "string" && gist.description ? gist.description : null,
        files: Object.keys(gist.files ?? {}),
        updatedAt: typeof gist.updated_at === "string" ? gist.updated_at : "",
      });
    }
    if (batch.length < 100) break;
  }
  return gists;
}

/**
 * One public gist with every file's content. A file GitHub truncated is read from its
 * `raw_url`, never past the content cap. A secret gist (fetchable by id) counts as not found.
 * Each file read spends the request's `budget`; once it is spent, the remaining files are
 * left out and counted in `budget.skipped`.
 */
export async function fetchGist(id: string, token: string | null, budget: GistBudget = newGistBudget()): Promise<GistDetail> {
  if (!isGistId(id)) throw new GithubError("notFound");
  const gist = (await githubGet(`/gists/${id}`, token)) as ApiGist;
  if (gist?.public !== true || gist.id !== id) throw new GithubError("notFound");

  const files: GistDetail["files"] = {};
  for (const [key, file] of Object.entries(gist.files ?? {})) {
    if (!file || typeof file.filename !== "string") continue;
    if (budget.files <= 0 || budget.chars <= 0) {
      budget.skipped += 1;
      continue;
    }
    let content = typeof file.content === "string" ? file.content : "";
    if (file.truncated === true) {
      if (typeof file.raw_url !== "string") continue;
      content = await fetchRawFile(file.raw_url);
    }
    if (content.length > budget.chars) {
      budget.chars = 0;
      budget.skipped += 1;
      continue;
    }
    budget.files -= 1;
    budget.chars -= content.length;
    files[key] = {
      filename: file.filename,
      language: typeof file.language === "string" ? file.language : null,
      content,
    };
  }
  return { id, description: typeof gist.description === "string" && gist.description ? gist.description : null, files };
}

/**
 * A truncated gist file, only from `https://gist.githubusercontent.com`, with no redirect
 * followed (one could leave the host) and no token sent. Reading stops just past the content
 * cap: the text then comes back over it, and the import counts it as too long.
 */
export async function fetchRawFile(rawUrl: string): Promise<string> {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    throw new GithubError("badUrl");
  }
  if (url.protocol !== "https:" || url.hostname !== RAW_HOST || url.port !== "" || url.username || url.password) {
    throw new GithubError("badUrl");
  }

  let response: Response;
  try {
    response = await fetch(url, {
      headers: { "User-Agent": "codstash-import" },
      redirect: "error",
      cache: "no-store",
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch {
    throw new GithubError("failed");
  }
  if (response.status === 403 || response.status === 429) throw new GithubError("rateLimit");
  if (!response.ok || !response.body) throw new GithubError("failed");

  // UTF-8 is at most 4 bytes a character: past this many bytes the text is over the cap.
  const maxBytes = (ITEM_LIMITS.content + 1) * 4;
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let text = "";
  let received = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      received += value.byteLength;
      text += decoder.decode(value, { stream: true });
      if (received > maxBytes || text.length > ITEM_LIMITS.content) {
        await reader.cancel();
        break;
      }
    }
  } catch {
    throw new GithubError("failed");
  }
  return text + decoder.decode();
}
