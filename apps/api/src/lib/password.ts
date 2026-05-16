import bcrypt from "bcryptjs";

import { badRequest } from "./httpErrors.js";

const minPasswordLength = 10;
const maxPasswordLength = 200;

export function validatePasswordPolicy(password: string): void {
  if (password.length < minPasswordLength) {
    throw badRequest("Password must be at least 10 characters.");
  }
  if (password.length > maxPasswordLength) {
    throw badRequest("Password must be 200 characters or fewer.");
  }
}

export async function hashPassword(password: string): Promise<string> {
  validatePasswordPolicy(password);
  return bcrypt.hash(password, 12);
}

export async function verifyPassword(
  password: string,
  hash: string,
): Promise<boolean> {
  return bcrypt.compare(password, hash);
}
