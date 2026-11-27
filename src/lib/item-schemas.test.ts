import { describe, expect, it } from "vitest";

import { createItemSchema, updateItemSchema } from "@/lib/item-schemas";

const link = (url: string) => ({ type: "link", title: "Link", url, tags: [], collectionIds: [] });

describe("link URLs", () => {
  it("accepts web addresses only, on create and on update", () => {
    for (const url of ["https://nextjs.org/docs", "http://localhost:3000", "HTTPS://EXAMPLE.COM"]) {
      expect(createItemSchema.safeParse(link(url)).success).toBe(true);
      expect(updateItemSchema.safeParse({ title: "Link", url, tags: [], collectionIds: [] }).success).toBe(true);
    }
    for (const url of ["javascript:alert(1)", "data:text/html,<script>alert(1)</script>", "mailto:a@b.c", "ftp://files.example.com", "file:///etc/passwd"]) {
      expect(createItemSchema.safeParse(link(url)).success).toBe(false);
      expect(updateItemSchema.safeParse({ title: "Link", url, tags: [], collectionIds: [] }).success).toBe(false);
    }
  });

  it("still says a blank link URL is required, not invalid", () => {
    const parsed = createItemSchema.safeParse(link(" "));
    expect(parsed.success).toBe(false);
    expect(parsed.error?.issues[0]?.message).toBe("items.urlRequired");
  });
});
