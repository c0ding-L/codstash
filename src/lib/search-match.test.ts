import { describe, expect, it } from "vitest";

import { normalizeSearchText, searchScore as score } from "@/lib/search-match";

/** The palette normalises the fields once up front; the tests do the same. */
function searchScore(search: string, title: string, others: string[] = []) {
  return score(search, normalizeSearchText(title), others.map(normalizeSearchText));
}

const DOCKERFILE = "FROM node:22-alpine AS deps WORKDIR /app COPY package.json package-lock.json ./";

describe("searchScore", () => {
  it("shows everything for an empty search", () => {
    expect(searchScore("  ", "Anything")).toBe(1);
  });

  it("does not match letters scattered across the title and the preview", () => {
    expect(searchScore("dark", "Multi-stage Dockerfile for Next.js", ["Snippet", DOCKERFILE])).toBe(0);
  });

  it("matches letters in order within one word of the title, from its start", () => {
    expect(searchScore("dckrfl", "Multi-stage Dockerfile")).toBeGreaterThan(0);
    expect(searchScore("ckrfl", "Multi-stage Dockerfile")).toBe(0);
  });

  it("matches the starts of several title words strung together", () => {
    expect(searchScore("gendoc", "Generate docstrings")).toBeGreaterThan(0);
    expect(searchScore("mdf", "Multi-stage Dockerfile for Next.js")).toBeGreaterThan(0);
  });

  it("does not let letters jump from the middle of one title word into another", () => {
    expect(searchScore("mail", "Multi-stage Dockerfile for Next.js", ["Snippet", DOCKERFILE])).toBe(0);
    expect(searchScore("gnrtdc", "Generate docstrings")).toBe(0);
  });

  it("matches the other fields only exactly", () => {
    expect(searchScore("alpine", "Multi-stage Dockerfile", [DOCKERFILE])).toBeGreaterThan(0);
    expect(searchScore("alpn", "Multi-stage Dockerfile", [DOCKERFILE])).toBe(0);
  });

  it("ranks a title prefix, then a title word, then a title substring, then another field", () => {
    const prefix = searchScore("dock", "Docker compose");
    const word = searchScore("dock", "Multi-stage Dockerfile");
    const inside = searchScore("ock", "Docker compose");
    const other = searchScore("dock", "Deploy", ["uses docker"]);

    expect(prefix).toBeGreaterThan(word);
    expect(word).toBeGreaterThan(inside);
    expect(inside).toBeGreaterThan(other);
  });

  it("needs every word of the search to match", () => {
    expect(searchScore("docker next", "Multi-stage Dockerfile for Next.js")).toBeGreaterThan(0);
    expect(searchScore("docker python", "Multi-stage Dockerfile for Next.js")).toBe(0);
  });

  it("ignores case and accents", () => {
    expect(searchScore("resume", "Résumé du projet")).toBe(1);
    expect(searchScore("RÉSU", "resume")).toBe(1);
  });

  it("keeps carets and backticks, which code searches use", () => {
    expect(searchScore("^2", "Pin to ^2.0")).toBeGreaterThan(0);
    expect(searchScore("`x`", "Wrap `x` in a tick")).toBeGreaterThan(0);
    expect(searchScore("^2", "Pin to 2.0")).toBe(0);
  });

  it("stays fast on a long title of words sharing a first letter", () => {
    const title = Array.from({ length: 40 }, () => "aaaa").join(" ");
    const started = performance.now();

    expect(searchScore("a".repeat(60) + "z", title)).toBe(0);
    expect(performance.now() - started).toBeLessThan(100);
  });
});
