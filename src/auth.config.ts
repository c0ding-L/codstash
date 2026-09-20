import type { NextAuthConfig } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import GitHub from "next-auth/providers/github";

/**
 * Edge-compatible half of the auth config: providers only, no adapter. The
 * proxy builds its own `auth` from this file so the Prisma / Neon adapter and
 * bcrypt never end up in its bundle. `GitHub` reads AUTH_GITHUB_ID and
 * AUTH_GITHUB_SECRET. `Credentials` is a placeholder that rejects everything;
 * `auth.ts` replaces it with the real bcrypt check.
 */
export default {
  providers: [GitHub, Credentials({ authorize: () => null })],
  pages: { signIn: "/sign-in" },
} satisfies NextAuthConfig;
