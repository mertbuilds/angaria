import { expect, test } from 'vitest';
import capabilities from '../../../desktop/src-tauri/capabilities/default.json';
import tauriConfig from '../../../desktop/src-tauri/tauri.conf.json';
import { APP_HOSTS } from './app-hosts.tsx';

const hostOf = (url: string) => new URL(url.replace(/\*$/, '')).hostname;

// The site promises the exact list, so it must move with the app: a host added
// to the http allowlist or the updater fails here until the page names it.
test('names exactly the hosts the desktop app reaches in production', () => {
  const http = capabilities.permissions.find(
    (permission) => typeof permission === 'object' && permission.identifier === 'http:default',
  );
  // Other permissions' scopes (opener's paths) share the inferred entry type.
  const allowed =
    typeof http === 'object'
      ? http.allow.flatMap((entry) => ('url' in entry ? [hostOf(entry.url)] : []))
      : [];
  const updater = tauriConfig.plugins.updater.endpoints.map(hostOf);
  const production = [...new Set([...allowed, ...updater])];

  expect(APP_HOSTS.map(({ host }) => host).toSorted()).toEqual(production.toSorted());
});
