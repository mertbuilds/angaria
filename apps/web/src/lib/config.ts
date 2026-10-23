/** The stable installer link a release writes to (docs/release.md). */
const DEFAULT_DOWNLOAD_URL = 'https://dl.angaria.app/latest/Angaria.dmg';

/**
 * The two ways to pay, one Polar product each in the Angaria org. Both start
 * with the 14-day trial and grant the same license key.
 */
export type Plan = 'monthly' | 'yearly';

/**
 * Each plan's Polar checkout link. After payment Polar sends the buyer to
 * /tesekkurler (the links' success URL).
 */
export const CHECKOUT_URLS: Record<Plan, string> = {
  monthly: 'https://buy.polar.sh/polar_cl_iRM6bSq3QNYvI2HxWXC4qBelvqkBLLnDjZiXX4IEAFd',
  yearly: 'https://buy.polar.sh/polar_cl_FqPTo5q2t7SEClFTzQiDz7BjP0bJlljl9Fp0l3wAbed',
};

/** Where a subscriber manages or cancels the plan and gets the license key again. */
export const CUSTOMER_PORTAL_URL = 'https://polar.sh/angaria/portal';

type Env = Partial<Record<keyof ImportMetaEnv, string | undefined>>;

function read(env: Env, name: keyof ImportMetaEnv): string | null {
  const value = env[name]?.trim();
  return value ? value : null;
}

/** The site's build-time config, from the VITE_ values in apps/web/.env.*. */
export function readConfig(env: Env) {
  return {
    downloadUrl: read(env, 'VITE_DOWNLOAD_URL') ?? DEFAULT_DOWNLOAD_URL,
    // No client id, no analytics: lib/analytics.ts never loads OpenPanel.
    openpanelClientId: read(env, 'VITE_OPENPANEL_CLIENT_ID'),
  };
}

export const config = readConfig(import.meta.env);
