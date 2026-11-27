import { afterEach, beforeEach, describe, expect, it, vi, type Mock } from "vitest";

import {
  GithubError,
  fetchGist,
  fetchRawFile,
  getGithubLogin,
  isGistId,
  isGithubUsername,
  listPublicGists,
} from "@/lib/github-gists";
import { ITEM_LIMITS } from "@/lib/item-limits";

const fetchMock = vi.fn();

beforeEach(() => {
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => {
  vi.unstubAllGlobals();
});

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });
const calls = () => (fetchMock as Mock).mock.calls as [string | URL, RequestInit][];
const headersOf = (call: [string | URL, RequestInit]) => new Headers(call[1].headers);

describe("isGithubUsername and isGistId", () => {
  it("follow GitHub's rules, so nothing else reaches a URL", () => {
    expect(isGithubUsername("octo-cat")).toBe(true);
    expect(isGithubUsername("a".repeat(39))).toBe(true);
    for (const bad of ["", "-octo", "octo-", "oc--to", "a".repeat(40), "../user", "octo/cat", "octo?x=1"]) {
      expect(isGithubUsername(bad)).toBe(false);
    }
    expect(isGistId("aa5a315d61ae9438b18d")).toBe(true);
    expect(isGistId("../../user")).toBe(false);
  });
});

describe("listPublicGists", () => {
  it("lists with the user's token when there is one", async () => {
    fetchMock.mockResolvedValue(
      json([
        { id: "abc123", public: true, description: "Bits", updated_at: "2026-11-01T00:00:00Z", files: { "a.ts": {}, "b.md": {} } },
        { id: "def456", public: false, description: "Secret", files: {} },
      ]),
    );

    const gists = await listPublicGists("octocat", "gho_token");

    expect(gists).toEqual([{ id: "abc123", description: "Bits", files: ["a.ts", "b.md"], updatedAt: "2026-11-01T00:00:00Z" }]);
    const [call] = calls();
    expect(String(call![0])).toBe("https://api.github.com/users/octocat/gists?per_page=100&page=1");
    expect(headersOf(call!).get("Authorization")).toBe("Bearer gho_token");
    expect(headersOf(call!).get("User-Agent")).toBe("codstash-import");
  });

  it("calls unauthenticated without a token", async () => {
    fetchMock.mockResolvedValue(json([]));

    await listPublicGists("octocat", null);

    expect(headersOf(calls()[0]!).has("Authorization")).toBe(false);
  });

  it("retries unauthenticated when GitHub refuses a revoked token", async () => {
    fetchMock.mockResolvedValueOnce(json({ message: "Bad credentials" }, 401)).mockResolvedValueOnce(json([]));

    await listPublicGists("octocat", "gho_revoked");

    expect(calls()).toHaveLength(2);
    expect(headersOf(calls()[1]!).has("Authorization")).toBe(false);
  });

  it("turns a 403 or 429 into the rate-limit error, and a 404 into not found", async () => {
    fetchMock.mockResolvedValueOnce(json({}, 403));
    await expect(listPublicGists("octocat", null)).rejects.toMatchObject({ kind: "rateLimit" });
    fetchMock.mockResolvedValueOnce(json({}, 429));
    await expect(listPublicGists("octocat", null)).rejects.toMatchObject({ kind: "rateLimit" });
    fetchMock.mockResolvedValueOnce(json({}, 404));
    await expect(listPublicGists("nobody", null)).rejects.toMatchObject({ kind: "notFound" });
  });

  it("refuses an invalid username without calling GitHub", async () => {
    await expect(listPublicGists("../admin", null)).rejects.toBeInstanceOf(GithubError);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("getGithubLogin", () => {
  it("reads the token's login, null when GitHub fails", async () => {
    fetchMock.mockResolvedValueOnce(json({ login: "octocat" }));
    expect(await getGithubLogin("gho_token")).toBe("octocat");
    expect(String(calls()[0]![0])).toBe("https://api.github.com/user");

    fetchMock.mockResolvedValueOnce(json({}, 500)).mockResolvedValueOnce(json({}, 500));
    expect(await getGithubLogin("gho_token")).toBeNull();
  });
});

describe("fetchGist", () => {
  it("returns a public gist's files with their content", async () => {
    fetchMock.mockResolvedValue(
      json({ id: "abc123", public: true, description: "Bits", files: { "a.ts": { filename: "a.ts", language: "TypeScript", content: "x" } } }),
    );

    expect(await fetchGist("abc123", null)).toEqual({
      id: "abc123",
      description: "Bits",
      files: { "a.ts": { filename: "a.ts", language: "TypeScript", content: "x" } },
    });
  });

  it("treats a secret gist as not found", async () => {
    fetchMock.mockResolvedValue(json({ id: "abc123", public: false, files: {} }));
    await expect(fetchGist("abc123", "gho_token")).rejects.toMatchObject({ kind: "notFound" });
  });

  it("reads a truncated file from its raw_url, without the token", async () => {
    fetchMock
      .mockResolvedValueOnce(
        json({
          id: "abc123",
          public: true,
          description: null,
          files: { "big.md": { filename: "big.md", language: "Markdown", content: "partial", truncated: true, raw_url: "https://gist.githubusercontent.com/u/abc123/raw/big.md" } },
        }),
      )
      .mockResolvedValueOnce(new Response("full text"));

    const gist = await fetchGist("abc123", "gho_token");

    expect(gist.files["big.md"]!.content).toBe("full text");
    const raw = calls()[1]!;
    expect(String(raw[0])).toBe("https://gist.githubusercontent.com/u/abc123/raw/big.md");
    expect(headersOf(raw).has("Authorization")).toBe(false);
    expect(raw[1].redirect).toBe("error");
    expect(raw[1].signal).toBeInstanceOf(AbortSignal);
  });

  it("refuses a raw_url on another host", async () => {
    fetchMock.mockResolvedValueOnce(
      json({
        id: "abc123",
        public: true,
        files: { "a.md": { filename: "a.md", content: "", truncated: true, raw_url: "http://169.254.169.254/latest/meta-data" } },
      }),
    );

    await expect(fetchGist("abc123", null)).rejects.toMatchObject({ kind: "badUrl" });
    expect(calls()).toHaveLength(1);
  });
});

describe("fetchRawFile", () => {
  it("accepts only https on gist.githubusercontent.com", async () => {
    for (const url of [
      "http://gist.githubusercontent.com/u/raw/a",
      "https://gist.githubusercontent.com.evil.com/a",
      "https://evil.com/gist.githubusercontent.com/a",
      "https://user:pass@gist.githubusercontent.com/a",
      "https://gist.githubusercontent.com:8443/a",
      "file:///etc/passwd",
      "not a url",
    ]) {
      await expect(fetchRawFile(url)).rejects.toMatchObject({ kind: "badUrl" });
    }
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("stops reading just past the content cap", async () => {
    const chunk = new TextEncoder().encode("x".repeat(50_000));
    let pulls = 0;
    const body = new ReadableStream<Uint8Array>({
      pull(controller) {
        pulls += 1;
        controller.enqueue(chunk);
      },
    });
    fetchMock.mockResolvedValue(new Response(body));

    const text = await fetchRawFile("https://gist.githubusercontent.com/u/raw/a");

    expect(text.length).toBeGreaterThan(ITEM_LIMITS.content);
    expect(pulls).toBeLessThan(10);
  });
});
