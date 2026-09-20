import { PrismaAdapter } from "@auth/prisma-adapter";
import NextAuth from "next-auth";

import authConfig from "@/auth.config";
import { prisma } from "@/lib/prisma";

/**
 * Full auth config. JWT sessions keep the proxy free of database calls; the
 * adapter still persists users and their GitHub accounts on first sign-in,
 * while the `Session` table stays unused.
 */
export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  adapter: PrismaAdapter(prisma),
  session: { strategy: "jwt" },
  callbacks: {
    // `user` is only present on the sign-in request, so copy the id into the
    // token then; later requests read it back from the token.
    jwt({ token, user }) {
      if (user?.id) token.id = user.id;
      return token;
    },
    session({ session, token }) {
      session.user.id = token.id;
      return session;
    },
  },
});
