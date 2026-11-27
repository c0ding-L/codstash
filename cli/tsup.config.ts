import { readFileSync } from "node:fs";

import { defineConfig } from "tsup";

const pkg = JSON.parse(readFileSync(new URL("./package.json", import.meta.url), "utf8")) as { version: string };

/** The production URL baked into the binary. `CORTEX_DEFAULT_URL` overrides it for a one-off build. */
const PRODUCTION_URL = "https://codstash.vercel.app";

const defaultUrl = (process.env.CORTEX_DEFAULT_URL || PRODUCTION_URL).replace(/\/+$/, "");
if (!/^https?:\/\/[^/]/.test(defaultUrl)) {
  throw new Error("Set PRODUCTION_URL in cli/tsup.config.ts (or CORTEX_DEFAULT_URL) to the production URL before building.");
}

export default defineConfig({
  entry: { cortex: "src/cortex.ts" },
  format: ["esm"],
  platform: "node",
  target: "node20",
  bundle: true,
  clean: true,
  banner: { js: "#!/usr/bin/env node" },
  define: {
    __CORTEX_VERSION__: JSON.stringify(pkg.version),
    __CORTEX_DEFAULT_URL__: JSON.stringify(defaultUrl),
  },
});
