import { randomUUID } from "node:crypto";

import { fillVariables, parseVariables, variableFields } from "../../src/lib/template-vars";
import { showControlChars } from "./controls";

/**
 * The text with its variables filled: each one asked in turn, its default shown and taken on an
 * empty answer. Without a terminal (`interactive` false) nothing is asked and defaults apply.
 */
export async function fillInteractive(
  text: string,
  ask: (question: string) => Promise<string>,
  interactive: boolean,
  now: Date = new Date(),
): Promise<string> {
  const values: Record<string, string> = {};
  if (interactive) {
    for (const field of variableFields(parseVariables(text))) {
      // A default is free text: escaped, so it cannot redraw the terminal around the prompt.
      const shown = field.default ? ` [${showControlChars(field.default)}]` : "";
      values[field.name] = await ask(`${field.name}${shown}: `);
    }
  }
  return fillVariables(text, values, { now, uuid: randomUUID });
}
