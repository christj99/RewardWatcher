import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
} from "node:crypto";

import { env } from "../config/env.js";

const algorithm = "aes-256-gcm";
const version = "v1";

export function encryptSecret(plainText: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv(algorithm, encryptionKey(), iv);
  const encrypted = Buffer.concat([
    cipher.update(plainText, "utf8"),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();

  return [
    version,
    iv.toString("base64url"),
    authTag.toString("base64url"),
    encrypted.toString("base64url"),
  ].join(":");
}

export function decryptSecret(cipherText: string): string {
  const parts = cipherText.split(":");

  if (parts.length !== 4 || parts[0] !== version) {
    throw new Error("Encrypted secret has an invalid format.");
  }

  const [, ivText, authTagText, encryptedText] = parts;
  if (!ivText || !authTagText || !encryptedText) {
    throw new Error("Encrypted secret has an invalid format.");
  }

  try {
    const decipher = createDecipheriv(
      algorithm,
      encryptionKey(),
      Buffer.from(ivText, "base64url"),
    );
    decipher.setAuthTag(Buffer.from(authTagText, "base64url"));
    const decrypted = Buffer.concat([
      decipher.update(Buffer.from(encryptedText, "base64url")),
      decipher.final(),
    ]);

    return decrypted.toString("utf8");
  } catch (error) {
    if (
      error instanceof Error &&
      error.message === "SECRET_ENCRYPTION_KEY is required."
    ) {
      throw error;
    }

    throw new Error("Encrypted secret could not be decrypted.", {
      cause: error,
    });
  }
}

function encryptionKey(): Buffer {
  const secret = process.env.SECRET_ENCRYPTION_KEY ?? env.SECRET_ENCRYPTION_KEY;

  if (!secret) {
    throw new Error("SECRET_ENCRYPTION_KEY is required.");
  }

  if (/^[A-Za-z0-9_-]{43,}$/.test(secret)) {
    try {
      const decoded = Buffer.from(secret, "base64url");
      if (decoded.length === 32) {
        return decoded;
      }
    } catch {
      // Fall through to deterministic hash key derivation.
    }
  }

  return createHash("sha256").update(secret).digest();
}
