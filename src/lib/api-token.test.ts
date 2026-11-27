import { describe, expect, it } from "vitest";

import { API_TOKEN_LENGTH, API_TOKEN_PREFIX_LENGTH, generateToken, hashToken, parseBearer } from "./api-token";

describe("generateToken", () => {
  it("is cstash_ plus 43 base64url characters", () => {
    const { token } = generateToken();
    expect(token).toHaveLength(API_TOKEN_LENGTH);
    expect(token).toMatch(/^cstash_[A-Za-z0-9_-]{43}$/);
  });

  it("returns the first 12 characters as the prefix and the token's hash", () => {
    const { token, prefix, hash } = generateToken();
    expect(prefix).toBe(token.slice(0, API_TOKEN_PREFIX_LENGTH));
    expect(prefix).toHaveLength(12);
    expect(hash).toBe(hashToken(token));
  });

  it("gives a new token each time", () => {
    expect(generateToken().token).not.toBe(generateToken().token);
  });
});

describe("hashToken", () => {
  it("is a stable SHA-256 in hex", () => {
    const hash = hashToken("cstash_abc");
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
    expect(hashToken("cstash_abc")).toBe(hash);
    expect(hashToken("cstash_abd")).not.toBe(hash);
  });
});

describe("parseBearer", () => {
  const { token } = generateToken();

  it("returns the token from a bearer header", () => {
    expect(parseBearer(`Bearer ${token}`)).toBe(token);
  });

  it("accepts any case of the scheme and extra spaces", () => {
    expect(parseBearer(`bearer   ${token} `)).toBe(token);
  });

  it.each([
    ["missing", null],
    ["empty", ""],
    ["no token", "Bearer "],
    ["wrong scheme", `Basic ${token}`],
    ["no scheme", token],
    ["wrong prefix", `Bearer xstash_${token.slice(7)}`],
    ["too short", `Bearer ${token.slice(0, -1)}`],
    ["too long", `Bearer ${token}A`],
    ["bad character", `Bearer ${token.slice(0, -1)}!`],
    ["two tokens", `Bearer ${token} ${token}`],
  ])("is null when %s", (_case, header) => {
    expect(parseBearer(header)).toBeNull();
  });
});
