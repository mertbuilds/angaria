import { expect, test } from 'vitest';
import capabilities from '../../../desktop/src-tauri/capabilities/default.json';
import tauriConfig from '../../../desktop/src-tauri/tauri.conf.json';
import { APP_HOSTS } from './app-hosts.tsx';

/** Hosts only dev builds reach: GİB's test portal and the Polar sandbox. */
const DEV_ONLY_HOSTS = new Set(['earsivportaltest.efatura.gov.tr', 'sandbox-api.polar.sh']);

const hostOf = (url: string) => new URL(url.replace(/\*$/, '')).hostname;

// The site promises the exact list, so it must move with the app: a host added
// to the http allowlist or the updater fails here until the page names it.
test('names exactly the hosts the desktop app reaches in production', () => {
  const http = capabilities.permissions.find(
    (permission) => typeof permission === 'object' && permission.identifier === 'http:default',
  );
  const allowed = typeof http === 'object' ? http.allow.map(({ url }) => hostOf(url)) : [];
  const updater = tauriConfig.plugins.updater.endpoints.map(hostOf);
  const production = [...new Set([...allowed, ...updater])].filter(
    (host) => !DEV_ONLY_HOSTS.has(host),
  );

  expect(APP_HOSTS.map(({ host }) => host).toSorted()).toEqual(production.toSorted());
});
