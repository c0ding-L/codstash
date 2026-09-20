import { NextResponse } from "next/server";
import NextAuth from "next-auth";

import authConfig from "@/auth.config";

// Built from the adapter-free config, not from `@/auth`, so the proxy bundle
// stays free of Prisma.
const { auth } = NextAuth(authConfig);

export const proxy = auth((req) => {
  if (req.auth) return NextResponse.next();

  const signInUrl = new URL("/sign-in", req.nextUrl.origin);
  signInUrl.searchParams.set("callbackUrl", req.nextUrl.pathname + req.nextUrl.search);

  return NextResponse.redirect(signInUrl);
});

// Only `/dashboard` and below run through the proxy, so `/api/auth/*` stays
// public and sign-in can complete; `/sign-in` and `/register` are outside it too.
export const config = {
  matcher: ["/dashboard/:path*"],
};
