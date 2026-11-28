import type { DefaultSession } from "next-auth";

import type { Role } from "@/lib/billing-plans";

declare module "next-auth" {
  interface Session {
    /** `isPro` and `role` are for the UI only; server-side gates read the database. */
    user: { id: string; isPro: boolean; role: Role } & DefaultSession["user"];
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
    /** `hasProAccess` as of the last request; unset right after sign-in. */
    isPro?: boolean;
    /** As of the last request; unset right after sign-in. */
    role?: Role;
  }
}
