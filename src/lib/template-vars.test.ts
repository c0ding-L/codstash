import { describe, expect, it } from "vitest";

import {
  fillVariables,
  isTemplatedType,
  parseVariables,
  templateSegments,
  variableFields,
} from "@/lib/template-vars";

// 9 March 2026, 23:30 local time: late enough that a UTC date could be the next day.
const NOW = new Date(2026, 2, 9, 23, 30);
const fixed = { now: NOW, uuid: () => "id-1" };

describe("parseVariables", () => {
  it("finds a simple variable and one with a default", () => {
    expect(parseVariables("docker exec -it {{container}} psql -U {{ user:postgres }}")).toEqual([
      { name: "container" },
      { name: "user", default: "postgres" },
    ]);
  });

  it("keeps each name once, in first-seen order, and the first default wins", () => {
    expect(parseVariables("{{b}} {{a:one}} {{b:x}} {{a:two}}")).toEqual([
      { name: "b" },
      { name: "a", default: "one" },
    ]);
  });

  it("trims the default and keeps an empty one", () => {
    expect(parseVariables("{{a:  spaced out  }} {{b:}}")).toEqual([
      { name: "a", default: "spaced out" },
      { name: "b", default: "" },
    ]);
  });

  it("ignores GitHub Actions expressions and dotted or spaced names", () => {
    const text = "${{ secrets.TOKEN }} ${{ matrix }} {{ .Values.image }} {{ user.name }} {{ two words }}";
    expect(parseVariables(text)).toEqual([]);
  });

  it("ignores an escaped variable", () => {
    expect(parseVariables("\\{{literal}} {{real}}")).toEqual([{ name: "real" }]);
  });

  it("marks the built-ins", () => {
    expect(parseVariables("{{date}} {{uuid}} {{date:2020-01-01}}")).toEqual([
      { name: "date", builtin: true },
      { name: "uuid", builtin: true },
    ]);
  });

  it("ignores an unclosed {{", () => {
    expect(parseVariables("{{open and {{a:never closed")).toEqual([]);
    expect(parseVariables("{{open {{ok}}")).toEqual([{ name: "ok" }]);
  });

  it("allows names up to 40 characters, no longer", () => {
    const forty = `a${"b".repeat(39)}`;
    expect(parseVariables(`{{${forty}}}`)).toEqual([{ name: forty }]);
    expect(parseVariables(`{{${forty}c}}`)).toEqual([]);
  });

  it("accepts dashes and underscores in names, not a leading digit", () => {
    expect(parseVariables("{{_a-b_1}} {{1abc}}")).toEqual([{ name: "_a-b_1" }]);
  });

  it("keeps unicode in a default", () => {
    expect(parseVariables("{{greeting:Héllo 世界 👋}}")).toEqual([{ name: "greeting", default: "Héllo 世界 👋" }]);
  });

  it("stays fast on 100,000 characters", () => {
    const text = "{{a:".repeat(25_000);
    const start = performance.now();
    expect(parseVariables(text)).toEqual([]);
    expect(parseVariables("x {{name}} ".repeat(10_000))).toEqual([{ name: "name" }]);
    expect(performance.now() - start).toBeLessThan(500);
  });
});

describe("variableFields", () => {
  it("leaves out built-ins without a default", () => {
    expect(variableFields(parseVariables("{{date}} {{uuid:fixed}} {{name}}"))).toEqual([
      { name: "uuid", default: "fixed", builtin: true },
      { name: "name" },
    ]);
  });
});

describe("fillVariables", () => {
  it("fills values, then defaults, then an empty string", () => {
    const text = "docker exec -it {{container}} psql -U {{user:postgres}} -d {{db}}";
    expect(fillVariables(text, { container: "api" }, fixed)).toBe("docker exec -it api psql -U postgres -d ");
  });

  it("treats an empty value as missing", () => {
    expect(fillVariables("{{user:postgres}}", { user: "" }, fixed)).toBe("postgres");
  });

  it("fills every occurrence, with the first default", () => {
    expect(fillVariables("{{a:one}}-{{a:two}}-{{a}}", {}, fixed)).toBe("one-one-one");
    expect(fillVariables("{{a:one}}-{{a}}", { a: "x" }, fixed)).toBe("x-x");
  });

  it("fills the date in local time and one uuid per name", () => {
    let calls = 0;
    const uuid = () => `id-${++calls}`;
    expect(fillVariables("{{date}} {{uuid}} {{ uuid }}", {}, { now: NOW, uuid })).toBe("2026-03-09 id-1 id-1");
    expect(calls).toBe(1);
  });

  it("lets a value or a default replace a built-in", () => {
    expect(fillVariables("{{date:soon}} {{uuid}}", { uuid: "mine" }, fixed)).toBe("soon mine");
  });

  it("drops the escaping backslash and leaves other braces alone", () => {
    const text = "\\{{name}} ${{ secrets.X }} {{ .Values }} {{name}}";
    expect(fillVariables(text, { name: "v" }, fixed)).toBe("{{name}} ${{ secrets.X }} {{ .Values }} v");
  });

  it("does not read inherited properties as values", () => {
    expect(fillVariables("{{constructor}}", {}, fixed)).toBe("");
  });
});

describe("templateSegments", () => {
  it("splits text and variables and joins back to the text", () => {
    const text = "Hi {{name}}, \\{{not}} ${{ x }} {{date}}!";
    const segments = templateSegments(text);
    expect(segments.filter((segment) => segment.kind === "variable").map((segment) => segment.text)).toEqual([
      "{{name}}",
      "{{date}}",
    ]);
    expect(segments.map((segment) => segment.text).join("")).toBe(text);
  });
});

describe("isTemplatedType", () => {
  it("is true for prompts and commands only", () => {
    expect(["prompt", "command", "snippet", "note", null].map(isTemplatedType)).toEqual([true, true, false, false, false]);
  });
});
