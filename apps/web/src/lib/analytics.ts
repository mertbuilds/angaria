import type { OpenPanel } from '@openpanel/web';
import { config } from './config.ts';

/** Where on the site a button sits, so the events can be told apart. */
export type CtaLocation = 'footer' | 'free' | 'header' | 'hero';

/**
 * The named events the site sends and what each carries. Page views are
 * tracked by OpenPanel itself.
 */
interface AnalyticsEvents {
  download_blocked_not_mac: { location: CtaLocation };
  download_click: { location: CtaLocation };
  source_click: { location: CtaLocation };
}

/** Only the live site counts: local dev, previews and other hosts send nothing. */
const LIVE_HOST = 'angaria.app';

// Resolves to undefined when the chunk fails, so events wait on it, then drop.
let openpanel: Promise<OpenPanel | undefined> | undefined;
// The loaded client, so a click calls it at once: both CTAs leave the page.
let loaded: OpenPanel | undefined;

/**
 * Loads OpenPanel once, on the client, on the live host and only with a
 * client id (VITE_OPENPANEL_CLIENT_ID). It posts through the same-origin
 * /api/op proxy (routes/api.op.$.ts). No cookies, no session replay, no
 * outgoing-link or attribute tracking: page views and the named events only.
 */
export function startAnalytics(
  clientId = config.openpanelClientId,
  host = typeof window === 'undefined' ? '' : window.location.hostname,
): void {
  if (import.meta.env.SSR || openpanel || clientId === null || host !== LIVE_HOST) {
    return;
  }
  openpanel = import('@openpanel/web')
    .then(
      ({ OpenPanel }) =>
        (loaded = new OpenPanel({
          apiUrl: '/api/op',
          clientId,
          trackAttributes: false,
          trackOutgoingLinks: false,
          trackScreenViews: true,
        })),
    )
    .catch((error: unknown) => {
      // oxlint-disable-next-line no-console -- the browser console is the only channel this failure has
      console.warn('openpanel failed to load', error);
      return undefined;
    });
}

/** Logs a failed send; the browser console is the only channel it has. */
const warnTrack = (event: string) => (error: unknown) => {
  // oxlint-disable-next-line no-console -- the browser console is the only channel this failure has
  console.warn('openpanel failed to track', event, error);
};

/**
 * Sends one named event. A loaded client sends it within the click (the SDK
 * posts with fetch keepalive, so it outlives the page); one tracked while
 * OpenPanel loads goes out once it has.
 */
export function track<Event extends keyof AnalyticsEvents>(
  event: Event,
  properties: AnalyticsEvents[Event],
): void {
  if (loaded) {
    void Promise.resolve(loaded.track(event, properties)).catch(warnTrack(event));
    return;
  }
  void openpanel?.then((client) => client?.track(event, properties)).catch(warnTrack(event));
}

/** Tests only: forget the started client. */
export function resetAnalyticsForTests() {
  openpanel = undefined;
  loaded = undefined;
}
