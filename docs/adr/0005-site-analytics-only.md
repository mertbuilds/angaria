# 0005. Cookieless PostHog on the site, no telemetry in the app

Accepted, 2026-10-01. Since `0013-free-and-open-source.md` (2026-10-12) the app reaches no Polar host.

## Context

Privacy is part of the product: no Angaria server, no tracking, credentials in the system keychain, data on the device. We still need to know whether the landing page converts.

## Decision

The site uses PostHog EU through its own `/ingest` proxy, cookieless (`persistence: 'memory'`): page views plus the named CTA events (`download_click`, `source_click`) only. Autocapture, session recording, surveys and heatmaps stay off. Without `VITE_POSTHOG_KEY` nothing loads. The desktop app has zero telemetry: no analytics and no crash reporting. It reaches only GİB, TCMB and `dl.angaria.app` (0004).

## Consequences

- The site sets no analytics cookies. A reload starts a new visitor, so counts are approximate.
- Analytics data stays in the EU, and the proxy keeps it first-party.
- There is no usage data from the app; product feedback comes from users directly.
- The site's privacy section lists the app's hosts (`app-hosts.tsx`), and a test fails when the app's allowlist or updater endpoint changes without it.
