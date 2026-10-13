import handler from '@tanstack/react-start/server-entry';
import { canonicalRedirect } from './lib/canonical.ts';
import { paraglideMiddleware } from './paraglide/server.js';

export default {
  async fetch(request: Request): Promise<Response> {
    return (
      canonicalRedirect(new URL(request.url)) ??
      (await paraglideMiddleware(request, () => handler.fetch(request)))
    );
  },
};
