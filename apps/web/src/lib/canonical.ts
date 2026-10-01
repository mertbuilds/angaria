/** The one host the site answers on. */
export const SITE_URL = 'https://angaria.app';
const WWW_HOST = 'www.angaria.app';

/**
 * www is a custom domain on this same Worker, so the move to the apex happens
 * here rather than in DNS. The path and the query ride along.
 */
export function canonicalRedirect(url: URL): Response | null {
  if (url.hostname !== WWW_HOST) {
    return null;
  }
  return Response.redirect(`${SITE_URL}${url.pathname}${url.search}`, 301);
}
