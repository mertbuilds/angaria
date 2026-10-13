import { createFileRoute } from '@tanstack/react-router';

const POSTHOG_HOST = 'https://eu.i.posthog.com';
const POSTHOG_ASSETS_HOST = 'https://eu-assets.i.posthog.com';
/**
 * Headers that carry who the visitor is. The analytics are anonymous, so the
 * proxy drops them and PostHog only ever sees the Worker.
 */
const IDENTIFYING_HEADERS = ['cf-connecting-ip', 'cookie', 'x-forwarded-for', 'x-real-ip'];

/**
 * Reverse proxy for PostHog ingest so adblockers do not drop events.
 * `/ingest/static/*` serves assets; everything else goes to the ingest API.
 */
async function proxy({ request }: { request: Request }): Promise<Response> {
  const url = new URL(request.url);
  const path = url.pathname.replace(/^\/ingest/, '');
  const upstreamHost = path.startsWith('/static/') ? POSTHOG_ASSETS_HOST : POSTHOG_HOST;
  const upstream = new URL(`${upstreamHost}${path}${url.search}`);
  const headers = new Headers(request.headers);
  headers.set('host', upstream.host);
  for (const name of IDENTIFYING_HEADERS) {
    headers.delete(name);
  }
  return fetch(upstream, {
    body:
      request.method === 'GET' || request.method === 'HEAD' ? null : await request.arrayBuffer(),
    headers,
    method: request.method,
  });
}

export const Route = createFileRoute('/ingest/$')({
  server: {
    handlers: {
      GET: proxy,
      POST: proxy,
    },
  },
});
