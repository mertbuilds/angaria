import { expect, test } from 'vitest';
import { readCredentials } from '../src/session.ts';

test('readCredentials reads the user code and password', () => {
  expect(readCredentials({ GIB_PASSWORD: 'secret', GIB_USERNAME: 'user' })).toEqual({
    password: 'secret',
    username: 'user',
  });
});

test('readCredentials requires username and password', () => {
  expect(() => readCredentials({ GIB_USERNAME: 'user' })).toThrow(/GIB_PASSWORD/);
  expect(() => readCredentials({ GIB_PASSWORD: 'secret' })).toThrow(/GIB_USERNAME/);
});
