// User messages for failed keychain calls. Keychain commands reject with the
// Rust error text (src-tauri/src/secrets.rs), e.g. "PlatformFailure: Platform
// secure storage failure: User interaction is not allowed." macOS answers that
// when it has to ask the user for access but cannot show the prompt.

const ACCESS_DENIED = 'User interaction is not allowed';

export const KEYCHAIN_ACCESS_HINT =
  'macOS, Anahtar Zinciri’ne erişime izin vermedi. Angaria’yı Finder’dan ya da Dock’tan açıp tekrar dene.';

function errorText(error: unknown): string {
  if (error instanceof Error) {
    return error.cause === undefined ? error.message : `${error.message} ${errorText(error.cause)}`;
  }
  return String(error);
}

/** The user message for a failed keychain call, with a hint when macOS refused access. */
export function keychainErrorMessage(message: string, error: unknown): string {
  if (!errorText(error).includes(ACCESS_DENIED)) {
    return message;
  }
  return `${/[.!?]$/.test(message) ? message : `${message}.`} ${KEYCHAIN_ACCESS_HINT}`;
}

/** Logs the underlying error of a failed keychain call and returns its user message. */
export function reportKeychainError(message: string, error: unknown): string {
  // oxlint-disable-next-line no-console -- release builds have no log plugin, so the console keeps the cause
  console.error(message, error);
  return keychainErrorMessage(message, error);
}
