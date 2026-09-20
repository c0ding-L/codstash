import type { NextAuthConfig } from "next-auth";
import GitHub from "next-auth/providers/github";

/**
 * Edge-compatible half of the auth config: providers only, no adapter. The
 * proxy builds its own `auth` from this file so the Prisma / Neon adapter never
 * ends up in its bundle. `GitHub` reads AUTH_GITHUB_ID and AUTH_GITHUB_SECRET.
 */
export default { providers: [GitHub] } satisfies NextAuthConfig;
