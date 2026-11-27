/** The binary's name, in help text and messages. A rename is this one line (and `bin` in package.json). */
export const BIN = "cortex";

declare const __CORTEX_VERSION__: string | undefined;
declare const __CORTEX_DEFAULT_URL__: string | undefined;

/** Set by tsup at build time; the fallbacks only serve the tests, which run the sources. */
export const VERSION = typeof __CORTEX_VERSION__ === "string" ? __CORTEX_VERSION__ : "0.0.0-dev";
export const DEFAULT_BASE_URL =
  typeof __CORTEX_DEFAULT_URL__ === "string" ? __CORTEX_DEFAULT_URL__ : "http://localhost:3000";
