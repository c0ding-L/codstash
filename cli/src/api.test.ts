import { describe, expect, it, vi } from "vitest";

import { ApiClient, ApiError, findItem, resolveCollectionId, resolveItem, type ApiItem } from "./api";
import { CliError } from "./errors";

const BASE = "https://cortex.test";

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

function item(id: string, overrides: Partial<ApiItem> = {}): ApiItem {
  return {
    id,
    title: `Item ${id}`,
    description: null,
    type: { id: "t1", slug: "command", name: "Command", isSystem: true },
    content: "echo hi",
    url: null,
    language: null,
    tags: [],
    collections: [],
    ...overrides,
  };
}

/** A client whose `fetch` answers from the list, in order. */
function clientWith(...responses: (Response | Error)[]) {
  const fetchMock = vi.fn<typeof fetch>();
  for (const response of responses) {
    if (response instanceof Error) fetchMock.mockRejectedValueOnce(response);
    else fetchMock.mockResolvedValueOnce(response);
  }
  return { client: new ApiClient(BASE, "cstash_secret", fetchMock), fetchMock };
}

describe("ApiClient", () => {
  it("sends the token as a bearer and returns `data`", async () => {
    const { client, fetchMock } = clientWith(json({ data: { id: "u1", name: "Ada", email: "a@x.test", isPro: true } }));
    expect(await client.me()).toMatchObject({ name: "Ada", isPro: true });

    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe(`${BASE}/api/v1/me`);
    expect(init?.method).toBe("GET");
    expect((init?.headers as Record<string, string>).Authorization).toBe("Bearer cstash_secret");
  });

  it("puts the filters in the query string, skipping empty ones", async () => {
    const { client, fetchMock } = clientWith(json({ data: [], nextCursor: null }));
    await client.listItems({ q: "docker prune", type: "command", tag: undefined, limit: 5 });
    expect(fetchMock.mock.calls[0]![0]).toBe(`${BASE}/api/v1/items?q=docker+prune&type=command&limit=5`);
  });

  it("posts JSON for a new item", async () => {
    const { client, fetchMock } = clientWith(json({ data: item("cnew") }, 201));
    await client.createItem({ type: "note", title: "t", content: "x", tags: [], collectionIds: [] });
    const init = fetchMock.mock.calls[0]![1]!;
    expect(init.method).toBe("POST");
    expect((init.headers as Record<string, string>)["Content-Type"]).toBe("application/json");
    expect(JSON.parse(init.body as string)).toEqual({ type: "note", title: "t", content: "x", tags: [], collectionIds: [] });
  });

  it("returns the context Markdown as text", async () => {
    const { client, fetchMock } = clientWith(new Response("# React hooks\n", { headers: { "Content-Type": "text/markdown" } }));
    expect(await client.collectionContext("c/1")).toBe("# React hooks\n");
    expect(fetchMock.mock.calls[0]![0]).toBe(`${BASE}/api/v1/collections/c%2F1/context`);
  });

  describe("errors", () => {
    async function errorOf(promise: Promise<unknown>) {
      return promise.then(
        () => {
          throw new Error("expected a rejection");
        },
        (error: unknown) => error,
      );
    }

    it("maps the API's error, with a login hint on 401", async () => {
      const { client } = clientWith(json({ error: { code: "invalid_token", message: "The API token is invalid." } }, 401));
      const error = await errorOf(client.me());
      expect(error).toBeInstanceOf(ApiError);
      expect(error).toMatchObject({ status: 401, code: "invalid_token", message: "The API token is invalid." });
      expect((error as ApiError).hint).toMatch(/cortex login/);
    });

    it("explains a read-only token's 403", async () => {
      const { client } = clientWith(
        json({ error: { code: "insufficient_scope", message: "This API token is read-only. Create a read + write token to write." } }, 403),
      );
      const error = (await errorOf(client.createItem({ type: "note", title: "t", content: "", tags: [], collectionIds: [] }))) as ApiError;
      expect(error.code).toBe("insufficient_scope");
      expect(error.hint).toMatch(/Read \+ write/);
    });

    it("explains the Pro 403", async () => {
      const { client } = clientWith(json({ error: { code: "pro_required", message: "Writing through the API requires CodStash Pro." } }, 403));
      const error = (await errorOf(client.createItem({ type: "note", title: "t", content: "", tags: [], collectionIds: [] }))) as ApiError;
      expect(error.hint).toMatch(/Pro plan/);
    });

    it("lists a 422's details under the message", async () => {
      const { client } = clientWith(
        json(
          { error: { code: "invalid_request", message: "The request is invalid.", details: [{ path: "url", message: "URL is required." }] } },
          422,
        ),
      );
      const error = (await errorOf(client.createItem({ type: "link", title: "t", content: "", tags: [], collectionIds: [] }))) as ApiError;
      expect(error.message).toBe("The request is invalid.\n  url: URL is required.");
      expect(error.hint).toBeUndefined();
    });

    it("falls back to the status when the body is not JSON", async () => {
      const { client } = clientWith(new Response("<html>Bad gateway</html>", { status: 502, statusText: "Bad Gateway" }));
      const error = (await errorOf(client.me())) as ApiError;
      expect(error).toMatchObject({ status: 502, code: "http_error", message: "The API answered 502 Bad Gateway." });
    });

    it("names the URL on a network error", async () => {
      const { client } = clientWith(new TypeError("fetch failed", { cause: new Error("connect ECONNREFUSED 127.0.0.1:3000") }));
      const error = await errorOf(client.me());
      expect(error).toBeInstanceOf(CliError);
      expect(error).not.toBeInstanceOf(ApiError);
      expect((error as CliError).message).toBe(`Could not reach ${BASE}/api/v1/me: connect ECONNREFUSED 127.0.0.1:3000`);
    });
  });
});

describe("short ids", () => {
  const full = "cmabcdefgh0000000wxyz1234";

  it("resolves a short id through idSuffix, then fetches the item in full", async () => {
    const { client, fetchMock } = clientWith(
      json({ data: [item(full, { content: "echo pre", truncated: true })], nextCursor: null }),
      json({ data: item(full, { content: "echo whole" }) }),
    );
    expect((await resolveItem(client, "wxyz1234")).content).toBe("echo whole");
    expect(fetchMock.mock.calls[0]![0]).toBe(`${BASE}/api/v1/items?idSuffix=wxyz1234&limit=50`);
    expect(fetchMock.mock.calls[1]![0]).toBe(`${BASE}/api/v1/items/${full}`);
  });

  it("fetches a full id directly", async () => {
    const { client, fetchMock } = clientWith(json({ data: item(full) }));
    await resolveItem(client, full);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0]![0]).toBe(`${BASE}/api/v1/items/${full}`);
  });

  it("lists both items when two ids share the suffix", async () => {
    const { client } = clientWith(json({ data: [item("cmaaaaaaaaaaaaaaawxyz1234"), item("cmbbbbbbbbbbbbbbbwxyz1234")], nextCursor: null }));
    const error = await resolveItem(client, "wxyz1234").catch((caught: unknown) => caught);
    expect(error).toBeInstanceOf(CliError);
    expect((error as CliError).message).toContain("cmaaaaaaaaaaaaaaawxyz1234");
    expect((error as CliError).message).toContain("cmbbbbbbbbbbbbbbbwxyz1234");
  });

  it("finds nothing for an unknown short id or a 404", async () => {
    const { client } = clientWith(
      json({ data: [], nextCursor: null }),
      json({ error: { code: "not_found", message: "Item not found." } }, 404),
    );
    expect(await findItem(client, "zzzz9999")).toBeNull();
    expect(await findItem(client, full)).toBeNull();
  });

  it("errors on an unknown item for get", async () => {
    const { client } = clientWith(json({ data: [], nextCursor: null }));
    await expect(resolveItem(client, "zzzz9999")).rejects.toThrow('No item with the id "zzzz9999".');
  });

  it("matches a collection's short id against the full list", async () => {
    const collections = [
      { id: "cm1111111111111111abcd1234", name: "React", description: null, itemCount: 1 },
      { id: "cm2222222222222222ffff0000", name: "Docker", description: null, itemCount: 2 },
    ];
    const { client, fetchMock } = clientWith(json({ data: collections }));
    expect(await resolveCollectionId(client, "abcd1234")).toBe("cm1111111111111111abcd1234");
    expect(fetchMock.mock.calls[0]![0]).toBe(`${BASE}/api/v1/collections`);
  });

  it("errors when no collection or several match", async () => {
    const twins = [
      { id: "cm1111111111111111abcd1234", name: "React", description: null, itemCount: 1 },
      { id: "cm2222222222222222abcd1234", name: "Docker", description: null, itemCount: 2 },
    ];
    const { client } = clientWith(json({ data: twins }), json({ data: twins }));
    await expect(resolveCollectionId(client, "abcd1234")).rejects.toThrow(/Several collections/);
    await expect(resolveCollectionId(client, "00000000")).rejects.toThrow('No collection with the id "00000000".');
  });

  it("passes a full collection id through without a request", async () => {
    const { client, fetchMock } = clientWith();
    expect(await resolveCollectionId(client, "cm1111111111111111abcd1234")).toBe("cm1111111111111111abcd1234");
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
