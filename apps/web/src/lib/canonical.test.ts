import { describe, expect, test } from 'vitest';
import { canonicalRedirect } from './canonical.ts';

describe('canonicalRedirect', () => {
  test('sends www to the apex with path and query', () => {
    const response = canonicalRedirect(new URL('https://www.angaria.app/gizlilik?ref=x'));
    expect(response?.status).toBe(301);
    expect(response?.headers.get('location')).toBe('https://angaria.app/gizlilik?ref=x');
  });

  test('leaves the apex and local hosts alone', () => {
    expect(canonicalRedirect(new URL('https://angaria.app/'))).toBeNull();
    expect(canonicalRedirect(new URL('https://angaria.localhost/'))).toBeNull();
  });
});
