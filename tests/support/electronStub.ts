type SafeStorageMock = {
  isEncryptionAvailable: () => boolean;
  encryptString: (plaintext: string) => Buffer;
  decryptString: (buffer: Buffer) => string;
};

const defaultSafeStorage: SafeStorageMock = {
  isEncryptionAvailable: () => false,
  encryptString: (plaintext: string) => Buffer.from(plaintext, "utf8"),
  decryptString: (buffer: Buffer) => buffer.toString("utf8"),
};

let safeStorageMock: SafeStorageMock = defaultSafeStorage;
const externalUrls: string[] = [];

export function setSafeStorageMock(mock: SafeStorageMock): void {
  safeStorageMock = mock;
}

export function resetElectronTestState(): void {
  safeStorageMock = defaultSafeStorage;
  externalUrls.length = 0;
}

export function getOpenedExternalUrls(): string[] {
  return [...externalUrls];
}

export const safeStorage = {
  isEncryptionAvailable(): boolean {
    return safeStorageMock.isEncryptionAvailable();
  },
  encryptString(plaintext: string): Buffer {
    return safeStorageMock.encryptString(plaintext);
  },
  decryptString(buffer: Buffer): string {
    return safeStorageMock.decryptString(buffer);
  },
};

export const shell = {
  openExternal(url: string): Promise<void> {
    externalUrls.push(url);
    return Promise.resolve();
  },
};
