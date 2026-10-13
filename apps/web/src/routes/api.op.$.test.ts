import { afterEach, describe, expect, test, vi } from 'vitest';
import { Route } from './api.op.$.ts';

type Handler = (context: { request: Request }) => Promise<Response>;
const handlers = (Route.options as unknown as { server: { handlers: Record<string, Handler> } })
  .server.handlers;
const post = (path: string, headers: Record<string, string> = {}) =>
  handlers['POST']!({
    request: new Request(`https://angaria.app${path}`, {
      body: '{"type":"track"}',
      headers,
      method: 'POST',
    }),
  });

describe('/api/op proxy', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  test('forwards a track call with the visitor address and nothing identifying beyond it', async () => {
    const calls: Array<[string, RequestInit]> = [];
    vi.stubGlobal('fetch', async (url: string, init: RequestInit) => {
      calls.push([url, init]);
      return Response.json({ deviceId: 'd' });
    });
    const res = await post('/api/op/track', {
      'cf-connecting-ip': '1.2.3.4',
      cookie: 'a=b',
      'openpanel-client-id': 'client-id',
      origin: 'https://angaria.app',
      referer: 'https://angaria.app/?q=1',
      'user-agent': 'UA',
    });
    expect(res.status).toBe(200);
    expect(calls[0]?.[0]).toBe('https://analytics.vinena.studio/api/track');
    const sent = new Headers(calls[0]?.[1].headers as HeadersInit);
    expect(sent.get('openpanel-client-ip')).toBe('1.2.3.4');
    expect(sent.get('x-client-ip')).toBe('1.2.3.4');
    expect(sent.get('openpanel-client-id')).toBe('client-id');
    expect(sent.get('cookie')).toBeNull();
    expect(sent.get('referer')).toBeNull();
  });

  test('refuses every path but /track and never shows the upstream body', async () => {
    const fetcher = vi.fn(async () => new Response('<html>secret</html>', { status: 401 }));
    vi.stubGlobal('fetch', fetcher);
    expect((await post('/api/op/profile/x')).status).toBe(404);
    expect(fetcher).not.toHaveBeenCalled();
    const upstream = await post('/api/op/track');
    expect(upstream.status).toBe(401);
    expect(await upstream.json()).toEqual({ error: 'Upstream error' });
  });
});
