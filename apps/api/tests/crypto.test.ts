import { afterEach, describe, expect, it } from "vitest";

import { decryptSecret, encryptSecret } from "../src/lib/crypto.js";

describe("secret encryption", () => {
  const originalKey = process.env.SECRET_ENCRYPTION_KEY;

  afterEach(() => {
    if (originalKey === undefined) {
      delete process.env.SECRET_ENCRYPTION_KEY;
    } else {
      process.env.SECRET_ENCRYPTION_KEY = originalKey;
    }
  });

  it("encrypts and decrypts a secret", () => {
    process.env.SECRET_ENCRYPTION_KEY = "test-secret-key";

    const encrypted = encryptSecret("access-token");

    expect(encrypted).not.toBe("access-token");
    expect(decryptSecret(encrypted)).toBe("access-token");
  });

  it("uses a random IV", () => {
    process.env.SECRET_ENCRYPTION_KEY = "test-secret-key";

    expect(encryptSecret("access-token")).not.toBe(
      encryptSecret("access-token"),
    );
  });

  it("fails clearly on malformed ciphertext", () => {
    process.env.SECRET_ENCRYPTION_KEY = "test-secret-key";

    expect(() => decryptSecret("not-valid")).toThrow(
      "Encrypted secret has an invalid format.",
    );
  });

  it("requires an encryption key", () => {
    delete process.env.SECRET_ENCRYPTION_KEY;

    expect(() => encryptSecret("access-token")).toThrow(
      "SECRET_ENCRYPTION_KEY is required.",
    );
  });
});
