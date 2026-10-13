import { createFileRoute } from '@tanstack/react-router';

/** The self-hosted OpenPanel instance the site counts its visits on. */
const OPENPANEL_API_BASE = 'https://analytics.vinena.studio/api';

/** The visitor's address as Cloudflare saw it; empty off Cloudflare. */
const clientIp = (request: Request) =>
  request.headers.get('cf-connecting-ip')?.trim() ||
  request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
  '';

/**
 * Same-origin proxy for @openpanel/web, so blockers see a first-party
 * request: only /track paths, a fixed set of forwarded headers (no cookies).
 * OpenPanel needs the visitor's address to tell visitors apart and to find
 * their country; it keeps a daily-salted hash, not the address. An upstream
 * error is answered with a short JSON error, never its body.
 */
async function proxy({ request }: { request: Request }): Promise<Response> {
  const url = new URL(request.url);
  const path = url.pathname.slice('/api/op'.length);
  if (path !== '/track' && !path.startsWith('/track/')) {
    return Response.json({ error: 'Not found' }, { status: 404 });
  }
  const headers = new Headers({
    'content-type': 'application/json',
    'openpanel-client-id': request.headers.get('openpanel-client-id') ?? '',
    origin: request.headers.get('origin') ?? url.origin,
    'user-agent': request.headers.get('user-agent') ?? '',
  });
  const ip = clientIp(request);
  if (ip) {
    headers.set('openpanel-client-ip', ip);
    headers.set('x-client-ip', ip);
  }
  try {
    const res = await fetch(`${OPENPANEL_API_BASE}${path}`, {
      body: request.method === 'POST' ? await request.text() : null,
      headers,
      method: request.method,
    });
    if (!res.ok) {
      return Response.json({ error: 'Upstream error' }, { status: res.status });
    }
    const body: unknown = res.headers.get('content-type')?.includes('application/json')
      ? await res.json()
      : await res.text();
    return Response.json(body, { status: res.status });
  } catch {
    return Response.json({ error: 'Failed to proxy request' }, { status: 500 });
  }
}

export const Route = createFileRoute('/api/op/$')({
  server: {
    handlers: {
      GET: proxy,
      POST: proxy,
    },
  },
});
