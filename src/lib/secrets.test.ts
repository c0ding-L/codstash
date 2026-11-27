import { describe, expect, it } from "vitest";

import { generateToken } from "@/lib/api-token";
import { containsSecrets, detectSecrets, scanItem, type SecretKind } from "@/lib/secrets";

/*
 * Made-up values with the right shape, never real keys. Each is built from pieces so the file
 * holds no literal a secret scanner (GitHub push protection) would take for a real key.
 */
const run = (chars: string, length: number) => chars.repeat(Math.ceil(length / chars.length)).slice(0, length);
const RANDOM = "q7Rk2Lm9Vt4Bn8Zc";

const POSITIVES: [SecretKind, string][] = [
  ["privateKey", "-----BEGIN " + "RSA PRIVATE KEY-----"],
  ["privateKey", "-----BEGIN " + "PRIVATE KEY-----"],
  ["aws", "AKIA" + "Q7RK2LM9VT4BN8ZC"],
  ["github", "ghp_" + run(RANDOM, 36)],
  ["github", "github_pat_" + run(RANDOM + "_", 60)],
  ["openai", "sk-" + "proj-" + run(RANDOM, 40)],
  ["anthropic", "sk-" + "ant-" + run(RANDOM, 40)],
  ["openrouter", "sk-" + "or-v1-" + run(RANDOM, 40)],
  ["stripe", "sk_" + "live_" + run(RANDOM, 24)],
  ["slack", "xoxb-" + "1234567890-" + run(RANDOM, 20)],
  ["google", "AIza" + run(RANDOM, 35)],
  ["codstash", "cstash_" + run(RANDOM, 43)],
  ["jwt", "eyJ" + run(RANDOM, 20) + "." + run(RANDOM, 20) + "." + run(RANDOM, 20)],
  ["connectionString", "postgres" + "://admin:" + "Zq8vR2kL" + "@db.internal:5432/app"],
  ["envAssignment", "STRIPE_" + "SECRET=" + run(RANDOM, 16)],
];

const PLACEHOLDERS: [SecretKind, string][] = [
  ["aws", "AKIA" + "IOSFODNN7EXAMPLE"],
  ["github", "ghp_" + run("x", 36)],
  ["github", "ghp_" + "your" + run("A", 32)],
  ["openai", "sk-xxxxxxxx"],
  ["openai", "sk-" + run("x", 30)],
  ["anthropic", "sk-" + "ant-" + run(".", 30)],
  ["stripe", "sk_" + "live_" + run("X", 24)],
  ["slack", "xoxb-" + "your-slack-token"],
  ["google", "AIza" + "YOUR" + run("x", 31)],
  ["jwt", "eyJ" + "hbGciOiJIUzI1NiJ9.only-two-parts"],
  ["connectionString", "postgres" + "://user:password@localhost:5432/app"],
  ["connectionString", "mysql" + "://root:${DB_PASS}@localhost"],
  ["connectionString", "postgres" + "://localhost:5432/app"],
  ["openai", "sk-" + "learn-preprocessing-pipeline"],
  ["envAssignment", "API_KEY=your-api-key"],
  ["envAssignment", "API_KEY=<your-key>"],
  ["envAssignment", "SECRET_TOKEN={{secret_token}}"],
  ["envAssignment", "DB_PASSWORD=changeme123"],
  ["envAssignment", 'API_KEY="********"'],
  ["envAssignment", "AUTH_TOKEN=short"],
];

describe("detectSecrets", () => {
  it.each(POSITIVES)("finds a %s", (kind, value) => {
    expect(detectSecrets(`before\n  ${value} after`).map((finding) => finding.kind)).toEqual([kind]);
  });

  it.each(PLACEHOLDERS)("ignores a %s placeholder: %s", (_kind, value) => {
    expect(detectSecrets(value)).toEqual([]);
  });

  it("gives the line and a masked preview", () => {
    const key = "ghp_" + run(RANDOM, 36);
    const [finding] = detectSecrets(`line one\nline two\nconst token = "${key}";`);
    expect(finding).toEqual({ kind: "github", line: 3, preview: "ghp_…" });
    expect(finding.preview).not.toContain(key.slice(4));
  });

  it("reports a key once, not also as an env line", () => {
    const findings = detectSecrets("OPENAI_API_KEY=" + "sk-" + "proj-" + run(RANDOM, 40));
    expect(findings.map((finding) => finding.kind)).toEqual(["openai"]);
  });

  it("finds an exported env secret, quoted", () => {
    expect(detectSecrets(`export GITHUB_TOKEN="${run(RANDOM, 12)}"`)).toEqual([
      { kind: "envAssignment", line: 1, preview: "GITH…" },
    ]);
  });

  it("finds several secrets in reading order", () => {
    const text = ["AWS = AKIA" + "Q7RK2LM9VT4BN8ZC", "nothing here", "AIza" + run(RANDOM, 35)].join("\n");
    expect(detectSecrets(text).map(({ kind, line }) => [kind, line])).toEqual([
      ["aws", 1],
      ["google", 3],
    ]);
  });

  it("misses a database password holding a raw `/` (a known gap: URLs percent-encode it)", () => {
    expect(detectSecrets("postgres" + "://admin:Zq8v/R2kL@db.internal/app")).toEqual([]);
    expect(detectSecrets("postgres" + "://admin:Zq8v%2FR2kL@db.internal/app").map(({ kind }) => kind)).toEqual([
      "connectionString",
    ]);
  });

  it("finds nothing in ordinary code", () => {
    const code = 'const skip = items.filter((x) => x.done);\nexport const TOKEN_TTL = 3600;\nfetch("/api/items?page=2");';
    expect(detectSecrets(code)).toEqual([]);
  });

  describe("in linear time", () => {
    // Near-misses that would make a backtracking pattern read the rest of the line again from each start.
    const inputs: [string, string][] = [
      ["ordinary text", run("const value = compute(items, 42); // note\n", 100_000)],
      ["JWT near-misses", run("eyJ-", 100_000)],
      ["URL near-misses", run("postgres" + "://", 100_000)],
      ["env name near-misses", run("TOKEN", 100_000)],
      ["key near-misses", run("sk-a", 100_000)],
    ];

    it.each(inputs)("scans 100,000 characters of %s in under 50 ms", (_name, text) => {
      detectSecrets(text.slice(0, 1_000)); // compiles the patterns first
      const started = performance.now();
      detectSecrets(text);
      expect(performance.now() - started).toBeLessThan(50);
    });
  });
});

describe("scanItem", () => {
  it("scans the URL, where a token can ride in the query string", () => {
    const findings = scanItem({
      title: "Weather API",
      description: null,
      content: null,
      url: "https://maps.example.com/api?key=AIza" + run(RANDOM, 35),
    });
    expect(findings).toEqual([{ kind: "google", line: 1, preview: "AIza…", field: "url" }]);
  });

  it("names the field of each finding", () => {
    const findings = scanItem({
      title: "Deploy",
      description: "uses AKIA" + "Q7RK2LM9VT4BN8ZC",
      content: "line\n" + "ghp_" + run(RANDOM, 36),
    });
    expect(findings.map(({ field, line }) => [field, line])).toEqual([
      ["description", 1],
      ["content", 2],
    ]);
  });
});

describe("containsSecrets", () => {
  it("is true when any field holds a secret", () => {
    expect(containsSecrets({ title: "x", content: "STRIPE_" + "SECRET=" + run(RANDOM, 16) })).toBe(true);
  });

  it("is false for a clean item", () => {
    expect(containsSecrets({ title: "Hello", description: "World", content: "print(1)", url: null })).toBe(false);
  });
});

describe("CodStash API tokens", () => {
  it("finds every generated token, at the end of a line too", () => {
    for (let i = 0; i < 200; i++) {
      const { token } = generateToken();
      expect(detectSecrets(`"Authorization": "Bearer ${token}"`).map((f) => f.kind)).toContain("codstash");
      expect(detectSecrets(`CODSTASH_TOKEN=${token}`).map((f) => f.kind)).toContain("codstash");
      expect(detectSecrets(token).map((f) => f.kind)).toEqual(["codstash"]);
    }
  });
});
