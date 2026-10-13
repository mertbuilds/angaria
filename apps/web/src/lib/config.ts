/** The stable installer link a release writes to (docs/release.md). */
const DEFAULT_DOWNLOAD_URL = 'https://dl.angaria.app/latest/Angaria.dmg';
/** The Worker's own proxy to PostHog EU (routes/ingest.$.ts). */
const DEFAULT_POSTHOG_HOST = '/ingest';

/** Angaria's public source code. */
export const SOURCE_URL = 'https://github.com/mertbuilds/angaria';
/** The license the code is published under, AGPL-3.0-only. */
export const LICENSE_URL = `${SOURCE_URL}/blob/main/LICENSE`;

type Env = Partial<Record<keyof ImportMetaEnv, string | undefined>>;

function read(env: Env, name: keyof ImportMetaEnv): string | null {
  const value = env[name]?.trim();
  return value ? value : null;
}

/** The site's build-time config, from the VITE_ values in apps/web/.env.*. */
export function readConfig(env: Env) {
  return {
    downloadUrl: read(env, 'VITE_DOWNLOAD_URL') ?? DEFAULT_DOWNLOAD_URL,
    posthogHost: read(env, 'VITE_POSTHOG_HOST') ?? DEFAULT_POSTHOG_HOST,
    // No key, no analytics: lib/analytics.ts never loads PostHog.
    posthogKey: read(env, 'VITE_POSTHOG_KEY'),
  };
}

export const config = readConfig(import.meta.env);
