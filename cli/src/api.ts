import { BIN } from "./constants";
import { CliError } from "./errors";

/** The REST API's shapes, as far as the CLI reads them (docs/api.md). */
export interface ApiItem {
  id: string;
  title: string;
  description: string | null;
  type: { id: string; slug: string; name: string; isSystem: boolean };
  content: string | null;
  url: string | null;
  language: string | null;
  tags: string[];
  collections: { id: string; name: string }[];
  truncated?: boolean;
}

export interface ApiCollection {
  id: string;
  name: string;
  description: string | null;
  itemCount: number;
}

export interface ApiMe {
  id: string;
  name: string | null;
  email: string;
  isPro: boolean;
}

export interface ItemFilters {
  q?: string;
  type?: string;
  tag?: string;
  idSuffix?: string;
  limit?: number;
}

export interface NewItem {
  type: string;
  title: string;
  content: string;
  language?: string;
  tags: string[];
  collectionIds: string[];
}

/** An error answer from the API: `{ error: { code, message } }`. */
export class ApiError extends CliError {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    hint?: string,
  ) {
    super(message, hint);
    this.name = "ApiError";
  }
}

/** A hint under the API's message, for the errors the user can fix. */
function hintFor(status: number, code: string): string | undefined {
  if (status === 401) return `Run \`${BIN} login\` with a valid API token.`;
  if (code === "insufficient_scope") {
    return `Saving needs a "Read + write" token: create one in Settings › API tokens, then run \`${BIN} login\` again.`;
  }
  if (code === "pro_required") return "Writing through the API needs an active Pro plan.";
  return undefined;
}

/** A 422's `details: [{ path, message }]`, one per line under the message. */
function formatDetails(details: unknown): string {
  if (!Array.isArray(details)) return "";
  return details
    .filter((detail): detail is { path?: unknown; message: string } => typeof detail?.message === "string")
    .map((detail) => `\n  ${typeof detail.path === "string" && detail.path ? `${detail.path}: ` : ""}${detail.message}`)
    .join("");
}

type Fetch = typeof fetch;

export class ApiClient {
  constructor(
    readonly baseUrl: string,
    private readonly token: string,
    private readonly fetchImpl: Fetch = fetch,
  ) {}

  /** The raw response, or an `ApiError` / `CliError` for an error answer or a network failure. */
  private async send(method: string, path: string, body?: unknown): Promise<Response> {
    const url = `${this.baseUrl}/api/v1${path}`;
    const headers: Record<string, string> = { Authorization: `Bearer ${this.token}`, Accept: "application/json" };
    if (body !== undefined) headers["Content-Type"] = "application/json";

    let response: Response;
    try {
      response = await this.fetchImpl(url, {
        method,
        headers,
        ...(body !== undefined && { body: JSON.stringify(body) }),
      });
    } catch (error) {
      const cause = error instanceof Error ? ((error.cause as Error | undefined)?.message ?? error.message) : String(error);
      throw new CliError(`Could not reach ${url}: ${cause}`, `Check the URL, or set it with \`${BIN} login --url\`.`);
    }

    if (!response.ok) {
      let code = "http_error";
      let message = `The API answered ${response.status} ${response.statusText}.`.replace(" .", ".");
      try {
        const payload = (await response.json()) as { error?: { code?: unknown; message?: unknown; details?: unknown } };
        if (typeof payload.error?.code === "string") code = payload.error.code;
        if (typeof payload.error?.message === "string") message = payload.error.message;
        message += formatDetails(payload.error?.details);
      } catch {
        // Not JSON (a proxy's error page): the status line says enough.
      }
      throw new ApiError(response.status, code, message, hintFor(response.status, code));
    }
    return response;
  }

  private async data<T>(method: string, path: string, body?: unknown): Promise<T> {
    const response = await this.send(method, path, body);
    return ((await response.json()) as { data: T }).data;
  }

  me() {
    return this.data<ApiMe>("GET", "/me");
  }

  listItems(filters: ItemFilters) {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(filters)) {
      if (value !== undefined && value !== "") params.set(key, String(value));
    }
    const query = params.size > 0 ? `?${params}` : "";
    return this.data<ApiItem[]>("GET", `/items${query}`);
  }

  getItem(id: string) {
    return this.data<ApiItem>("GET", `/items/${encodeURIComponent(id)}`);
  }

  createItem(item: NewItem) {
    return this.data<ApiItem>("POST", "/items", item);
  }

  listCollections() {
    return this.data<ApiCollection[]>("GET", "/collections");
  }

  async collectionContext(id: string): Promise<string> {
    const response = await this.send("GET", `/collections/${encodeURIComponent(id)}/context`);
    return response.text();
  }
}

/** The last 8 characters of an id, as the app shows them (A1). cuid prefixes are shared, so not the first. */
export function shortId(id: string) {
  return id.slice(-8);
}

const SHORT_ID = /^[a-z0-9]{8}$/i;

export function isShortId(value: string) {
  return SHORT_ID.test(value);
}

function ambiguous(what: string, suffix: string, matches: { id: string; label: string }[]) {
  const list = matches.map((match) => `  ${match.id}  ${match.label}`).join("\n");
  return new CliError(`Several ${what}s end with "${suffix}":\n${list}`, "Use the full id.");
}

/**
 * The item for a full or short id, in full. A short id goes through `idSuffix`; none found is
 * `null`, so `run` can fall back to a search.
 */
export async function findItem(client: ApiClient, id: string): Promise<ApiItem | null> {
  if (!isShortId(id)) {
    try {
      return await client.getItem(id);
    } catch (error) {
      if (error instanceof ApiError && error.status === 404) return null;
      throw error;
    }
  }

  const matches = await client.listItems({ idSuffix: id, limit: 50 });
  if (matches.length === 0) return null;
  if (matches.length > 1) {
    throw ambiguous("item", id, matches.map((item) => ({ id: item.id, label: item.title })));
  }
  // The list's content is a 300-character preview.
  return client.getItem(matches[0]!.id);
}

/** Like `findItem`, but none found is an error. */
export async function resolveItem(client: ApiClient, id: string): Promise<ApiItem> {
  const item = await findItem(client, id);
  if (!item) throw new CliError(`No item with the id "${id}".`, `Find it with \`${BIN} search\`.`);
  return item;
}

/**
 * A collection's full id. The collections route returns them all, so a short id is matched here,
 * with no API filter.
 */
export async function resolveCollectionId(client: ApiClient, id: string): Promise<string> {
  if (!isShortId(id)) return id;
  const matches = (await client.listCollections()).filter((collection) => collection.id.endsWith(id));
  if (matches.length === 0) throw new CliError(`No collection with the id "${id}".`);
  if (matches.length > 1) {
    throw ambiguous("collection", id, matches.map((collection) => ({ id: collection.id, label: collection.name })));
  }
  return matches[0]!.id;
}
