import { describe, expect, test } from 'vitest';
import capabilitiesSource from '../../../desktop/src-tauri/capabilities/default.json?raw';
import { APP_HOSTS_SOURCE, APP_HOSTS_SOURCE_URL, readConfig } from './config.ts';

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

describe('APP_HOSTS_SOURCE', () => {
  test('points at the desktop http allowlist, with GİB and TCMB inside the linked lines', () => {
    const lines = capabilitiesSource.split('\n');
    const [first, last] = APP_HOSTS_SOURCE.lines;
    const linked = lines.slice(first - 1, last).join('\n');
    expect(linked).toContain('"identifier": "http:default"');
    expect(linked).toContain('earsivportal.efatura.gov.tr');
    expect(linked).toContain('www.tcmb.gov.tr');
    expect(lines[last]?.trim()).toBe('}');
    expect(APP_HOSTS_SOURCE_URL).toBe(
      `https://github.com/mertbuilds/angaria/blob/main/${APP_HOSTS_SOURCE.file}#L${first}-L${last}`,
    );
  });
});
