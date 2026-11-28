// The `{ success, data, error }` shape every server action returns, and its builders.
// Outside the `"use server"` files, which may only export actions.

import type { z } from "zod";

import type { Errors } from "@/i18n/errors-server";

/** An action's result. `field` names the input at fault when validation failed, so the form can mark it. */
export type ActionResult<T = null, F extends string = never> =
  | { success: true; data: T; error: null }
  | { success: false; data: null; error: string; field?: F };

/** The result of an action that returns no data and names no field. */
export type SimpleActionResult = { success: boolean; error: string | null };

/** A failed result with this message. */
export function fail(error: string): { success: false; data: null; error: string } {
  return { success: false, data: null, error };
}

/**
 * The first validation issue as a failed result, naming the field at fault when it is one of
 * `fields`. Only a string path counts: `tags[0]` has the number 0 after `tags`, never a field.
 */
export function invalidInput<F extends string>(
  e: Errors,
  error: z.ZodError,
  fields: ReadonlySet<string> | readonly string[],
): { success: false; data: null; error: string; field?: F } {
  const issue = error.issues[0];
  const field = issue?.path[0];
  const known = Array.isArray(fields) ? fields.includes(field as string) : (fields as ReadonlySet<string>).has(field as string);
  return { ...fail(e.issue(issue)), ...(typeof field === "string" && known && { field: field as F }) };
}
