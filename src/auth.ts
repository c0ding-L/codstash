import { PrismaAdapter } from "@auth/prisma-adapter";
import bcrypt from "bcryptjs";
import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";

import authConfig from "@/auth.config";
import { prisma } from "@/lib/prisma";

/**
 * Full auth config. JWT sessions keep the proxy free of database calls; the
 * adapter still persists users and their GitHub accounts on first sign-in,
 * while the `Session` table stays unused. Credentials sign-in requires JWT
 * sessions, which is already what this uses.
 */
export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  providers: [
    // Drop the placeholder from the edge config and put the real one in its place.
    ...authConfig.providers.filter(
      // Bare provider functions (GitHub) are kept; only the Credentials object is dropped.
      (provider) => typeof provider === "function" || provider.id !== "credentials",
    ),
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        const { email, password } = credentials ?? {};
        if (typeof email !== "string" || typeof password !== "string") return null;

        const user = await prisma.user.findUnique({
          where: { email: email.trim().toLowerCase() },
        });
        // GitHub-only users have no password, so they cannot sign in this way.
        if (!user?.password) return null;

        if (!(await bcrypt.compare(password, user.password))) return null;

        return { id: user.id, name: user.name, email: user.email, image: user.image };
      },
    }),
  ],
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
