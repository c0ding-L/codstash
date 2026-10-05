import { PrismaAdapter } from "@auth/prisma-adapter";
import bcrypt from "bcryptjs";
import NextAuth, { CredentialsSignin } from "next-auth";
import Credentials from "next-auth/providers/credentials";

import authConfig from "@/auth.config";
import { EmailNotVerifiedError, RateLimitedError } from "@/lib/auth-errors";
import { isEmailVerificationEnabled } from "@/lib/email-verification-flag";
import { prisma } from "@/lib/prisma";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";

/**
 * A real cost-12 hash of a random string nobody knows. Comparing against it when
 * there is no account keeps sign-in as slow as a wrong password, so the response
 * time does not reveal which emails are registered.
 */
const DUMMY_PASSWORD_HASH = "$2b$12$4Zg1Vf0KNkLo4pW5dRE1EOgppJQCQw4caOJzNweX3Uwt4mSrmUTf2";

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
      // Both the sign-in server action and a direct POST to
      // /api/auth/callback/credentials land here, so the limit covers both.
      // `request` carries the caller's headers on either path.
      async authorize(credentials, request) {
        const { email, password } = credentials ?? {};
        if (typeof email !== "string" || typeof password !== "string") return null;
        const normalizedEmail = email.trim().toLowerCase();

        const limit = await checkRateLimit("signIn", `${getClientIp(request.headers)}:${normalizedEmail}`);
        if (!limit.success) throw new RateLimitedError(limit.reset);

        const user = await prisma.user.findUnique({
          where: { email: normalizedEmail },
        });
        // GitHub-only users have no password, so they cannot sign in this way.
        const matches = await bcrypt.compare(password, user?.password ?? DUMMY_PASSWORD_HASH);
        if (!user?.password || !matches) return null;

        // Only after the password is right, so this cannot be used to find out
        // which emails are registered.
        if (isEmailVerificationEnabled() && !user.emailVerified) {
          throw new EmailNotVerifiedError();
        }

        return { id: user.id, name: user.name, email: user.email, image: user.image };
      },
    }),
  ],
  adapter: PrismaAdapter(prisma),
  session: { strategy: "jwt" },
  logger: {
    // A refused sign-in (wrong password, unverified email) is handled by the
    // form, so it is not logged as a server error. Everything else still is.
    error(error) {
      if (error instanceof CredentialsSignin) return;
      console.error("[auth][error]", error);
    },
  },
  callbacks: {
    // `user` is only present on the sign-in request, so copy the id and the
    // sign-in time into the token then. On later requests, returning null ends
    // the session: the account is gone, or its password changed after this
    // sign-in. Change password signs the current session in again first.
    async jwt({ token, user }) {
      if (user?.id) {
        token.id = user.id;
        token.authTime = Date.now();
        return token;
      }

      const account = await prisma.user.findUnique({
        where: { id: token.id },
        select: { passwordChangedAt: true },
      });
      if (!account) return null;
      if (account.passwordChangedAt && account.passwordChangedAt.getTime() > (token.authTime ?? 0)) return null;
      return token;
    },
    session({ session, token }) {
      session.user.id = token.id;
      return session;
    },
  },
});
