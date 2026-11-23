import type { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    /** `isPro` is for the UI only; server-side gates read `getPlanStatus`. */
    user: { id: string; isPro: boolean } & DefaultSession["user"];
  }
}

// `next-auth/jwt` only re-exports this interface from `@auth/core`, and an
// augmentation of a re-export does not merge into the original — it has to
// target the module that declares `JWT`.
declare module "@auth/core/jwt" {
  interface JWT {
    id: string;
    /** Sign-in time in ms; absent on tokens issued before it was added. */
    authTime?: number;
    /** `isProActive(proUntil)` as of the last request; unset right after sign-in. */
    isPro?: boolean;
  }
}
