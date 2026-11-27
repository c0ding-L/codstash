import { templateSegments } from "@/lib/template-vars";

/** The part of an mdast node this plugin reads. Kept local: `mdast` is only a transitive dependency. */
export interface MarkdownNode {
  type: string;
  value?: string;
  children?: MarkdownNode[];
  data?: object;
}

/** A tinted inline span, in both themes. */
const VARIABLE_CLASSES = ["rounded", "bg-amber-400/15", "px-0.5", "font-mono", "text-amber-600", "dark:text-amber-300"];

function splitText(node: MarkdownNode, names: ReadonlySet<string>): MarkdownNode[] {
  const segments = templateSegments(node.value ?? "");
  if (!segments.some((segment) => segment.kind === "variable" && names.has(segment.name))) return [node];
  return segments.map((segment) =>
    segment.kind === "text" || !names.has(segment.name)
      ? { type: "text", value: segment.text }
      : {
          type: "templateVariable",
          value: segment.text,
          // Turned into `<span class=…>{{name}}</span>` by mdast-util-to-hast.
          data: {
            hName: "span",
            hProperties: { className: VARIABLE_CLASSES, "data-variable": segment.name },
            hChildren: [{ type: "text", value: segment.text }],
          },
        },
  );
}

function walk(node: MarkdownNode, names: ReadonlySet<string>): void {
  if (!node.children) return;
  node.children = node.children.flatMap((child) => {
    if (child.type === "text") return splitText(child, names);
    walk(child, names);
    return [child];
  });
}

export interface RemarkTemplateVarsOptions {
  /**
   * The variables of the raw text (`parseVariables`). Markdown drops the backslash of an escaped
   * `\{{name}}` before this plugin runs, so only these names are highlighted.
   */
  names: ReadonlySet<string>;
}

/**
 * Highlights template variables (roadmap § B) in the text of a Markdown preview. Code blocks and
 * inline code hold their text in `value`, not in text children, so they are left as they are.
 */
export function remarkTemplateVars({ names }: RemarkTemplateVarsOptions) {
  return (tree: MarkdownNode) => walk(tree, names);
}
