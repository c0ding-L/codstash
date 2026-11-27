import { describe, expect, it } from "vitest";

import { type MarkdownNode, remarkTemplateVars } from "@/lib/remark-template-vars";

function run(tree: MarkdownNode, names = ["name", "date"]): MarkdownNode {
  remarkTemplateVars({ names: new Set(names) })(tree);
  return tree;
}

describe("remarkTemplateVars", () => {
  it("wraps each variable of a text node in a span", () => {
    const tree = run({
      type: "root",
      children: [{ type: "paragraph", children: [{ type: "text", value: "Hi {{name}}, it is {{date}}." }] }],
    });
    const children = tree.children![0]!.children!;

    expect(children.map((child) => [child.type, child.value])).toEqual([
      ["text", "Hi "],
      ["templateVariable", "{{name}}"],
      ["text", ", it is "],
      ["templateVariable", "{{date}}"],
      ["text", "."],
    ]);
    expect(children[1]!.data).toMatchObject({ hName: "span", hChildren: [{ type: "text", value: "{{name}}" }] });
  });

  it("leaves code, other braces and plain text alone", () => {
    const code = { type: "code", value: "{{name}}" };
    const inline = { type: "inlineCode", value: "{{name}}" };
    const plain = { type: "text", value: "${{ secrets.X }} and {{ a.b }}" };
    const tree = run({ type: "root", children: [code, { type: "paragraph", children: [inline, plain] }] });

    expect(tree.children![0]).toBe(code);
    expect(tree.children![1]!.children).toEqual([inline, plain]);
  });

  it("leaves a name that is not a variable of the raw text, such as an escaped one", () => {
    // `\{{name}}` reaches the plugin as `{{name}}`: Markdown has dropped the backslash.
    const text = { type: "text", value: "Literal {{name}} here." };
    const tree = run({ type: "root", children: [{ type: "paragraph", children: [text] }] }, []);

    expect(tree.children![0]!.children).toEqual([text]);
  });
});
