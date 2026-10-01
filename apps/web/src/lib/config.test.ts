import { describe, expect, test } from 'vitest';
import { readConfig } from './config.ts';

describe('readConfig', () => {
  test('uses the values that are set', () => {
    expect(
      readConfig({
        VITE_CHECKOUT_URL: 'https://polar.sh/checkout',
        VITE_DOWNLOAD_URL: 'https://example.com/Angaria.dmg',
        VITE_POSTHOG_HOST: 'https://eu.i.posthog.com',
        VITE_POSTHOG_KEY: 'phc_test',
      }),
    ).toEqual({
      checkoutUrl: 'https://polar.sh/checkout',
      downloadUrl: 'https://example.com/Angaria.dmg',
      posthogHost: 'https://eu.i.posthog.com',
      posthogKey: 'phc_test',
    });
  });

  test('falls back when values are empty or missing', () => {
    expect(readConfig({ VITE_CHECKOUT_URL: '  ', VITE_POSTHOG_KEY: '' })).toEqual({
      checkoutUrl: '/#fiyat',
      downloadUrl: 'https://dl.angaria.app/latest/Angaria.dmg',
      posthogHost: '/ingest',
      posthogKey: null,
    });
  });
});
