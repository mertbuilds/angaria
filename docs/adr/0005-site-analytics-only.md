# 0005. Cookieless analytics on the site, no telemetry in the app

Accepted, 2026-10-01. Since `0013-free-and-open-source.md` (2026-10-12) the app reaches no Polar host.

## Context

Privacy is part of the product: no Angaria server, no tracking, credentials in the system keychain, data on the device. We still need to know whether the landing page converts.

## Decision

The site uses the self-hosted OpenPanel at analytics.vinena.studio (since 2026-10-13; PostHog EU through an `/ingest` proxy before) through its own `/api/op` proxy, with no cookies and no browser storage: page views plus the named CTA events (`download_click`, `source_click`) only. Session replay, outgoing-link and attribute tracking are off, and it runs only on the live host `angaria.app`. OpenPanel needs the visitor IP and user agent to tell visitors apart (a daily-salted hash) and to find the country, so the proxy forwards the IP; the privacy page says so. The server is in Nuremberg, Germany (Hetzner), so analytics data stays in the EU. The desktop app has zero telemetry: no analytics and no crash reporting. It reaches only GİB, TCMB and `dl.angaria.app` (0004).

## Consequences

- The site sets no analytics cookies. One visitor is counted once per day (a daily-salted IP and user agent hash); no cookies.
- Analytics data stays in the EU, and the proxy keeps it first-party.
- There is no usage data from the app; product feedback comes from users directly.
- The site's privacy section lists the app's hosts (`app-hosts.tsx`), and a test fails when the app's allowlist or updater endpoint changes without it.
