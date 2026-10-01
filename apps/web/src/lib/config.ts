/** The stable installer link a release writes to (docs/release.md). */
const DEFAULT_DOWNLOAD_URL = 'https://dl.angaria.app/latest/Angaria.dmg';
/** The Worker's own proxy to PostHog EU (routes/ingest.$.ts). */
const DEFAULT_POSTHOG_HOST = '/ingest';
/**
 * Where a checkout button points without its plan's checkout link. Only a local
 * production build gets here: the `deploy` script refuses to build without both.
 */
const CHECKOUT_FALLBACK = '/#fiyat';

/**
 * The two ways to pay, one Polar product each. Both start with the 14-day trial
 * and grant the same license key.
 */
export type Plan = 'monthly' | 'yearly';

type Env = Partial<Record<keyof ImportMetaEnv, string | undefined>>;

function read(env: Env, name: keyof ImportMetaEnv): string | null {
  const value = env[name]?.trim();
  return value ? value : null;
}

/** The site's build-time config, from the VITE_ values in apps/web/.env.*. */
export function readConfig(env: Env) {
  return {
    checkoutUrls: {
      monthly: read(env, 'VITE_CHECKOUT_URL_MONTHLY') ?? CHECKOUT_FALLBACK,
      yearly: read(env, 'VITE_CHECKOUT_URL_YEARLY') ?? CHECKOUT_FALLBACK,
    } satisfies Record<Plan, string>,
    downloadUrl: read(env, 'VITE_DOWNLOAD_URL') ?? DEFAULT_DOWNLOAD_URL,
    posthogHost: read(env, 'VITE_POSTHOG_HOST') ?? DEFAULT_POSTHOG_HOST,
    // No key, no analytics: lib/analytics.ts never loads PostHog.
    posthogKey: read(env, 'VITE_POSTHOG_KEY'),
  };
}

export const config = readConfig(import.meta.env);
