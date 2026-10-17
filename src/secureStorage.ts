/**
 * @file secureStorage.ts
 * @description Transparent at-rest encryption for sensitive plugin credentials
 * using Electron's `safeStorage` API.
 *
 * Delegates to the OS credential store:
 *   - macOS  — Keychain
 *   - Windows — DPAPI (Data Protection API, user-scoped)
 *   - Linux  — Secret Service / kwallet; falls back to a basic cipher
 *
 * Encrypted values are stored as `"enc:<base64>"` so legacy plaintext values
 * are detected and migrated automatically on the next save.
 *
 * Encrypted values are bound to the current OS user account. Re-authenticating
 * is required after moving a vault to a new machine.
 */

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { safeStorage } = require("electron") as typeof import("electron");

const ENC_PREFIX = "enc:";

/**
 * Returns `true` when OS credential store encryption is available.
 * On Linux, returns `false` when no keyring daemon is running.
 */
export function isEncryptionAvailable(): boolean {
  try {
    return safeStorage.isEncryptionAvailable();
  } catch {
    return false;
  }
}

/**
 * Encrypt `plaintext` for safe storage on disk.
 * Returns `"enc:<base64>"` when OS encryption is available, or the original
 * plaintext with a console warning when it is not.
 */
export function encrypt(plaintext: string): string {
  if (!plaintext) return "";

  if (!isEncryptionAvailable()) {
    console.warn(
      "[CalendarNoteIntegration] OS encryption unavailable — credential stored as plaintext."
    );
    return plaintext;
  }

  const buf = safeStorage.encryptString(plaintext);
  return ENC_PREFIX + buf.toString("base64");
}

/**
 * Decrypt a value previously produced by {@link encrypt}.
 * Handles both encrypted and legacy plaintext values transparently.
 * Returns an empty string on failure so the caller treats it as "not authenticated".
 */
export function decrypt(stored: string): string {
  if (!stored) return "";

  if (!stored.startsWith(ENC_PREFIX)) return stored;

  try {
    const buf = Buffer.from(stored.slice(ENC_PREFIX.length), "base64");
    return safeStorage.decryptString(buf);
  } catch {
    console.error(
      "[CalendarNoteIntegration] Failed to decrypt credential. The vault may have been " +
        "moved to a different machine. Please re-authenticate."
    );
    return "";
  }
}
