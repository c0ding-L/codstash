import type { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    user: { id: string } & DefaultSession["user"];
  }
}

// `next-auth/jwt` only re-exports this interface from `@auth/core`, and an
// augmentation of a re-export does not merge into the original — it has to
// target the module that declares `JWT`.
declare module "@auth/core/jwt" {
  interface JWT {
    id: string;
  }
}
