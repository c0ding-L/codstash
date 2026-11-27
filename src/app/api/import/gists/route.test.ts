import { afterEach, beforeEach, describe, expect, it, vi, type Mock } from "vitest";

import { GET, POST } from "@/app/api/import/gists/route";
import { auth } from "@/auth";
import { getPlanStatus } from "@/lib/db/billing";
import { getGithubAccessToken, importCandidates } from "@/lib/db/import";
import { checkRateLimit } from "@/lib/rate-limit";

vi.mock("@/auth", () => ({ auth: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/db/billing", () => ({ getPlanStatus: vi.fn() }));
vi.mock("@/lib/db/import", () => ({ getGithubAccessToken: vi.fn(), importCandidates: vi.fn() }));
vi.mock("@/lib/rate-limit", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/rate-limit")>()),
  checkRateLimit: vi.fn(),
}));

const asMock = (fn: unknown) => fn as Mock;
const fetchMock = vi.fn();
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });
const fetchCalls = () => fetchMock.mock.calls as [string | URL, RequestInit][];

function listRequest(username?: string) {
  const url = new URL("http://localhost/api/import/gists");
  if (username !== undefined) url.searchParams.set("username", username);
  return GET(new Request(url));
}

function importRequest(body: unknown) {
  return POST(
    new Request("http://localhost/api/import/gists", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }),
  );
}

const gist = (id: string) => ({
  id,
  public: true,
  description: "Bits",
  files: { "a.ts": { filename: "a.ts", language: "TypeScript", content: "export {}" } },
});

const emptyResult = {
  created: 0,
  skipped: { duplicate: 0, file: 0, tooLong: 0, invalid: 0, limit: 0 },
  invalidTitles: [],
  collectionsCreated: 0,
  collectionLinksDropped: 0,
};

beforeEach(() => {
  vi.stubGlobal("fetch", fetchMock);
  asMock(auth).mockResolvedValue({ user: { id: "user_1" } });
  asMock(getPlanStatus).mockResolvedValue({ isPro: false, items: 0, collections: 0 });
  asMock(checkRateLimit).mockResolvedValue({ success: true, remaining: 59, reset: Date.now() + 60_000 });
  asMock(getGithubAccessToken).mockResolvedValue(null);
  asMock(importCandidates).mockImplementation(async (_user: string, candidates: unknown[]) => ({ ...emptyResult, created: candidates.length }));
});
afterEach(() => {
  vi.unstubAllGlobals();
});

describe("GET /api/import/gists", () => {
  it("answers 401 without a session", async () => {
    asMock(auth).mockResolvedValue(null);
    expect((await listRequest("octocat")).status).toBe(401);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("refuses an invalid username before calling GitHub", async () => {
    const response = await listRequest("../admin");
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "Enter a valid GitHub username." });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("without a token, calls GitHub unauthenticated and has no default username", async () => {
    const none = await listRequest();
    expect(await none.json()).toEqual({ username: null, gists: [] });
    expect(fetchMock).not.toHaveBeenCalled();

    fetchMock.mockResolvedValue(json([{ id: "abc123", public: true, description: null, updated_at: "2026-11-01T00:00:00Z", files: { "a.ts": {} } }]));
    const listed = await listRequest("octocat");

    expect(await listed.json()).toEqual({ username: "octocat", gists: [{ id: "abc123", description: null, files: ["a.ts"], updatedAt: "2026-11-01T00:00:00Z" }] });
    expect(new Headers(fetchCalls()[0]![1].headers).has("Authorization")).toBe(false);
  });

  it("defaults to the linked account's login, read with its token", async () => {
    asMock(getGithubAccessToken).mockResolvedValue("gho_token");
    fetchMock.mockResolvedValueOnce(json({ login: "octocat" })).mockResolvedValueOnce(json([]));

    const response = await listRequest();

    expect(await response.json()).toEqual({ username: "octocat", gists: [] });
    expect(String(fetchCalls()[0]![0])).toBe("https://api.github.com/user");
    expect(String(fetchCalls()[1]![0])).toContain("/users/octocat/gists");
    expect(new Headers(fetchCalls()[1]![1].headers).get("Authorization")).toBe("Bearer gho_token");
  });

  it("turns GitHub's 403 into the friendly rate-limit error", async () => {
    fetchMock.mockResolvedValue(json({ message: "API rate limit exceeded" }, 403));

    const response = await listRequest("octocat");

    expect(response.status).toBe(429);
    expect(await response.json()).toEqual({ error: "GitHub rate limit reached. Try again later." });
  });

  it("answers 429 past our own limit", async () => {
    asMock(checkRateLimit).mockResolvedValue({ success: false, remaining: 0, reset: Date.now() + 60_000 });
    expect((await listRequest("octocat")).status).toBe(429);
    expect(checkRateLimit).toHaveBeenCalledWith("import", "user_1");
  });
});

describe("POST /api/import/gists", () => {
  it("answers 401 without a session", async () => {
    asMock(auth).mockResolvedValue(null);
    expect((await importRequest({ gistIds: ["abc123"] })).status).toBe(401);
  });

  it("answers 400 for bad ids or more than 100 gists", async () => {
    expect((await importRequest({ gistIds: ["../../user"] })).status).toBe(400);
    expect((await importRequest({ gistIds: [] })).status).toBe(400);
    expect((await importRequest({ gistIds: Array.from({ length: 101 }, (_, i) => `a${i}`) })).status).toBe(400);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("imports one candidate per file under the Free limits", async () => {
    fetchMock.mockImplementation(async (url: string) => json(gist(String(url).split("/").pop()!)));

    const response = await importRequest({ gistIds: ["abc123", "def456"] });

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ created: 2, gistsNotFetched: 0 });
    const [user, candidates, options] = asMock(importCandidates).mock.calls[0]!;
    expect(user).toBe("user_1");
    expect(candidates).toEqual([
      expect.objectContaining({ title: "a", type: "snippet", language: "typescript", tags: ["gist"] }),
      expect.objectContaining({ title: "a", type: "snippet" }),
    ]);
    expect(options).toMatchObject({ conflict: "skip", maxItems: 50, maxCollections: 3, customTypes: false });
  });

  it("refuses a truncated file whose raw_url is on another host", async () => {
    fetchMock.mockResolvedValue(
      json({ ...gist("abc123"), files: { "a.md": { filename: "a.md", content: "", truncated: true, raw_url: "https://evil.example.com/a" } } }),
    );

    const response = await importRequest({ gistIds: ["abc123"] });

    expect(fetchCalls().map(([url]) => String(url))).toEqual(["https://api.github.com/gists/abc123"]);
    expect(await response.json()).toMatchObject({ created: 0, gistsNotFetched: 1 });
  });

  it("imports what was fetched before GitHub's rate limit and warns", async () => {
    fetchMock.mockResolvedValueOnce(json(gist("abc123"))).mockResolvedValue(json({}, 403));

    const response = await importRequest({ gistIds: ["abc123", "def456", "aaa111", "bbb222", "ccc333", "ddd444", "eee555"] });

    expect(await response.json()).toMatchObject({
      created: 1,
      gistsNotFetched: 6,
      warning: "GitHub rate limit reached. Try again later.",
    });
    // The second group of five is never asked for.
    expect(fetchCalls()).toHaveLength(5);
  });

  it("answers the friendly 429 when GitHub's limit leaves nothing to import", async () => {
    fetchMock.mockResolvedValue(json({}, 429));

    const response = await importRequest({ gistIds: ["abc123"] });

    expect(response.status).toBe(429);
    expect(await response.json()).toEqual({ error: "GitHub rate limit reached. Try again later." });
    expect(importCandidates).not.toHaveBeenCalled();
  });
});
