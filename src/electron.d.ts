/**
 * Minimal Electron type declarations for the APIs used by this plugin.
 * Obsidian runs on Electron; these types are available at runtime via require("electron").
 */
declare module "electron" {
  interface SafeStorage {
    isEncryptionAvailable(): boolean;
    encryptString(plaintext: string): Buffer;
    decryptString(encrypted: Buffer): string;
  }

  interface Shell {
    openExternal(url: string, options?: { activate?: boolean }): Promise<void>;
  }

  const safeStorage: SafeStorage;
  const shell: Shell;
}
