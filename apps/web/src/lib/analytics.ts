import type { PostHog } from 'posthog-js';
import { config } from './config.ts';

/** Where on the site a button sits, so the events can be told apart. */
export type CtaLocation = 'footer' | 'free' | 'header' | 'hero' | 'mcp';

/**
 * The named events the site sends and what each carries. Page views are
 * captured by PostHog itself.
 */
interface AnalyticsEvents {
  download_click: { location: CtaLocation };
  source_click: { location: CtaLocation };
}

let client: PostHog | null = null;
let starting = false;

/**
 * Loads PostHog once, on the client, and only with a key. Without
 * VITE_POSTHOG_KEY nothing is fetched or sent and `track` does nothing.
 * Cookieless: identity lives in memory, so a reload starts a new visitor.
 */
export async function startAnalytics(key = config.posthogKey): Promise<void> {
  if (key === null || starting || typeof window === 'undefined') {
    return;
  }
  starting = true;
  const { default: posthog } = await import('posthog-js');
  posthog.init(key, {
    advanced_disable_flags: true,
    api_host: config.posthogHost,
    autocapture: false,
    capture_dead_clicks: false,
    capture_heatmaps: false,
    capture_pageleave: false,
    capture_pageview: 'history_change',
    capture_performance: false,
    defaults: '2026-05-30',
    disable_external_dependency_loading: true,
    disable_session_recording: true,
    disable_surveys: true,
    persistence: 'memory',
    person_profiles: 'identified_only',
    ui_host: 'https://eu.posthog.com',
  });
  client = posthog;
}

/**
 * Sends one named event. A CTA usually leaves the page right after the click,
 * so the event goes out at once as a beacon instead of waiting in the batch.
 */
export function track<Event extends keyof AnalyticsEvents>(
  event: Event,
  properties: AnalyticsEvents[Event],
): void {
  client?.capture(event, properties, { send_instantly: true, transport: 'sendBeacon' });
}
