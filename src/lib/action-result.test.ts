import { describe, expect, it } from "vitest";
import { z } from "zod";

import { getErrors } from "@/i18n/errors-server";
import { fail, invalidInput } from "@/lib/action-result";

const schema = z.object({ title: z.string().min(1, "items.titleRequired"), tags: z.array(z.string().min(1, "items.tagEmpty")) });

describe("invalidInput", () => {
  it("names a known field and translates the issue", async () => {
    const e = await getErrors();
    const parsed = schema.safeParse({ title: "", tags: [] });

    expect(parsed.success).toBe(false);
    expect(invalidInput(e, parsed.error!, new Set(["title", "tags"]))).toEqual({
      success: false,
      data: null,
      error: e.message("items.titleRequired"),
      field: "title",
    });
  });

  it("names the field of an array element by its string path only", async () => {
    const e = await getErrors();
    const parsed = schema.safeParse({ title: "x", tags: [""] });

    expect(invalidInput(e, parsed.error!, ["title", "tags"])).toMatchObject({ field: "tags" });
  });

  it("leaves `field` out for a field the form does not have", async () => {
    const e = await getErrors();
    const parsed = schema.safeParse({ title: "", tags: [] });

    expect(invalidInput(e, parsed.error!, ["tags"])).not.toHaveProperty("field");
  });
});

describe("fail", () => {
  it("builds a failed result", () => {
    expect(fail("Nope.")).toEqual({ success: false, data: null, error: "Nope." });
  });
});
