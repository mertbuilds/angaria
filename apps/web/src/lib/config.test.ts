import { describe, expect, test } from 'vitest';
import { readConfig } from './config.ts';

describe('readConfig', () => {
  test('uses the values that are set', () => {
    expect(
      readConfig({
        VITE_DOWNLOAD_URL: 'https://example.com/Angaria.dmg',
        VITE_OPENPANEL_CLIENT_ID: 'client-id',
      }),
    ).toEqual({
      downloadUrl: 'https://example.com/Angaria.dmg',
      openpanelClientId: 'client-id',
    });
  });

  test('falls back when values are empty or missing', () => {
    expect(readConfig({ VITE_DOWNLOAD_URL: '  ', VITE_OPENPANEL_CLIENT_ID: '' })).toEqual({
      downloadUrl: 'https://dl.angaria.app/latest/Angaria.dmg',
      openpanelClientId: null,
    });
  });
});
