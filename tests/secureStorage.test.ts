import test from "node:test";
import assert from "node:assert/strict";
import { decrypt, encrypt, isEncryptionAvailable } from "../src/secureStorage";
import {
  resetElectronTestState,
  setSafeStorageMock,
} from "./support/electronStub";

test.afterEach(() => {
  resetElectronTestState();
});

test("secureStorage encrypts and decrypts when OS encryption is available", () => {
  setSafeStorageMock({
    isEncryptionAvailable: () => true,
    encryptString: (plaintext: string) => Buffer.from(`cipher:${plaintext}`),
    decryptString: (buffer: Buffer) =>
      buffer.toString("utf8").replace(/^cipher:/, ""),
  });

  const encrypted = encrypt("secret-value");
  assert.match(encrypted, /^enc:/);
  assert.equal(decrypt(encrypted), "secret-value");
});

test("secureStorage falls back to plaintext when encryption is unavailable", () => {
  setSafeStorageMock({
    isEncryptionAvailable: () => false,
    encryptString: (plaintext: string) => Buffer.from(plaintext),
    decryptString: (buffer: Buffer) => buffer.toString("utf8"),
  });

  assert.equal(isEncryptionAvailable(), false);
  assert.equal(encrypt("secret-value"), "secret-value");
  assert.equal(decrypt("secret-value"), "secret-value");
});

test("secureStorage returns an empty string when decryption fails", () => {
  setSafeStorageMock({
    isEncryptionAvailable: () => true,
    encryptString: (plaintext: string) => Buffer.from(plaintext),
    decryptString: () => {
      throw new Error("wrong machine");
    },
  });

  assert.equal(decrypt(`enc:${Buffer.from("secret").toString("base64")}`), "");
});
