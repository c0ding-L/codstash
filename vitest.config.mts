import { fileURLToPath } from "node:url";

import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
  test: {
    environment: "node",
    // Server actions and utilities only. Components are deliberately not tested.
    include: ["src/actions/**/*.test.ts", "src/lib/**/*.test.ts"],
    // Without this, Node loads next-auth directly, and it can't resolve its
    // extensionless `next/server` import.
    server: { deps: { inline: ["next-auth"] } },
    // Vitest doesn't load `.env` into `process.env`. Blanking these as well means a
    // test that forgets a mock fails instead of reaching a real service, even when
    // the shell has them set.
    env: {
      DATABASE_URL: "",
      UPSTASH_REDIS_REST_URL: "",
      UPSTASH_REDIS_REST_TOKEN: "",
      RESEND_API_KEY: "",
    },
    // Before each test, a mock goes back to the implementation given to `vi.fn(...)`,
    // so a `mockResolvedValue` can't leak into the next test.
    mockReset: true,
  },
});
