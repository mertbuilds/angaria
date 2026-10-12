import { describe, expect, test, vi } from 'vitest';
import {
  KEYCHAIN_ACCESS_HINT,
  keychainErrorMessage,
  reportKeychainError,
} from '../src/lib/keychain-error.ts';

const DENIED = 'PlatformFailure: Platform secure storage failure: User interaction is not allowed.';

describe('keychainErrorMessage', () => {
  test('keeps the message for other keychain errors', () => {
    expect(
      keychainErrorMessage(
        'GİB şifresi sistem anahtar zincirine kaydedilemedi.',
        'NoStorageAccess: Couldn’t access platform secure storage: The keychain is locked.',
      ),
    ).toBe('GİB şifresi sistem anahtar zincirine kaydedilemedi.');
  });

  test('adds the macOS hint when keychain access was not allowed', () => {
    expect(
      keychainErrorMessage('GİB şifresi sistem anahtar zincirine kaydedilemedi.', DENIED),
    ).toBe(`GİB şifresi sistem anahtar zincirine kaydedilemedi. ${KEYCHAIN_ACCESS_HINT}`);
  });

  test('ends a message without a period before the hint', () => {
    expect(keychainErrorMessage("GİB şifresi Anahtar Zinciri'nden okunamadı", DENIED)).toBe(
      `GİB şifresi Anahtar Zinciri'nden okunamadı. ${KEYCHAIN_ACCESS_HINT}`,
    );
  });

  test('finds the cause in an Error and its cause chain', () => {
    expect(keychainErrorMessage('Okunamadı.', new Error(DENIED))).toBe(
      `Okunamadı. ${KEYCHAIN_ACCESS_HINT}`,
    );
    expect(keychainErrorMessage('Okunamadı.', new Error('outer', { cause: DENIED }))).toBe(
      `Okunamadı. ${KEYCHAIN_ACCESS_HINT}`,
    );
  });
});

test('reportKeychainError logs the underlying error', () => {
  const log = vi.spyOn(console, 'error').mockImplementation(() => {});

  expect(reportKeychainError('Kaydedilemedi.', DENIED)).toBe(
    `Kaydedilemedi. ${KEYCHAIN_ACCESS_HINT}`,
  );
  expect(log).toHaveBeenCalledWith('Kaydedilemedi.', DENIED);
  log.mockRestore();
});
