/** The stable installer link a release writes to (docs/release.md). */
const DEFAULT_DOWNLOAD_URL = 'https://dl.angaria.app/latest/Angaria.dmg';
/** The Worker's own proxy to PostHog EU (routes/ingest.$.ts). */
const DEFAULT_POSTHOG_HOST = '/ingest';
/**
 * Where the checkout buttons point without a checkout link. Only a local
 * production build gets here: the `deploy` script refuses to build without one.
 */
const CHECKOUT_FALLBACK = '/#fiyat';

type Env = Partial<Record<keyof ImportMetaEnv, string | undefined>>;

function read(env: Env, name: keyof ImportMetaEnv): string | null {
  const value = env[name]?.trim();
  return value ? value : null;
}

/** The site's build-time config, from the VITE_ values in apps/web/.env.*. */
export function readConfig(env: Env) {
  return {
    checkoutUrl: read(env, 'VITE_CHECKOUT_URL') ?? CHECKOUT_FALLBACK,
    downloadUrl: read(env, 'VITE_DOWNLOAD_URL') ?? DEFAULT_DOWNLOAD_URL,
    posthogHost: read(env, 'VITE_POSTHOG_HOST') ?? DEFAULT_POSTHOG_HOST,
    // No key, no analytics: lib/analytics.ts never loads PostHog.
    posthogKey: read(env, 'VITE_POSTHOG_KEY'),
  };
}

export const config = readConfig(import.meta.env);
