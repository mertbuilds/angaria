import { expect, test } from 'vitest';
import { readCredentials } from '../src/session.ts';

test('readCredentials defaults to the production portal', () => {
  expect(readCredentials({ GIB_PASSWORD: 'secret', GIB_USERNAME: 'user' })).toEqual({
    password: 'secret',
    testMode: false,
    username: 'user',
  });
  expect(
    readCredentials({ GIB_PASSWORD: 'secret', GIB_TEST_MODE: '1', GIB_USERNAME: 'user' }).testMode,
  ).toBe(false);
});

test('readCredentials enables test mode only for "true"', () => {
  expect(
    readCredentials({ GIB_PASSWORD: 'secret', GIB_TEST_MODE: 'true', GIB_USERNAME: 'user' })
      .testMode,
  ).toBe(true);
});

test('readCredentials requires username and password', () => {
  expect(() => readCredentials({ GIB_USERNAME: 'user' })).toThrow(/GIB_PASSWORD/);
  expect(() => readCredentials({ GIB_PASSWORD: 'secret' })).toThrow(/GIB_USERNAME/);
});
