// Password hashing. Server-only: bcrypt must never reach a client bundle.

import bcrypt from "bcryptjs";

export const BCRYPT_ROUNDS = 12;

export function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, BCRYPT_ROUNDS);
}
