# 0006. Local GİB and TCMB emulator for development and tests

Accepted, 2026-10-01.

## Context

The production GİB e-Arşiv portal issues real legal documents. The shared test portal's demo accounts are locked by other people's sessions most of the time. The TCMB rates feed is an outside service too. Development and tests against them are unsafe, flaky, or both.

## Decision

`packages/gib-emulator` is a local `node:http` stand-in for the e-Arşiv portal and the TCMB feed on `http://127.0.0.1:5180`. All development, tests and manual QA run against it, never against live GİB. The SDK's tests start it in-process. The SDK's smoke script (`packages/earsiv-sdk/scripts/smoke.ts`) runs against it too, unless `EARSIV_MODE=prod` points it at the production portal with your own account: it creates a draft and deletes it, and never signs. The desktop app reaches it through Ayarlar › Gelişmiş › Emülatör (dev only), with a dev-only http allowlist overlay. The switch is off on a fresh dev run, so a dev build reaches the production portal until you turn it on. The `/__emulator` API sets faults (latency, 5xx, an error text on HTTP 200, maintenance HTML, session locks) and state.

Update 2026-10-02: the app, the SDK and the MCP server dropped GİB's test portal mode. The emulator replaces it; production builds reach only the production portal.

## Consequences

- Tests are deterministic and offline, and the failure paths are testable.
- Production builds contain neither the emulator URL nor the switch.
- The emulator models what we know of the portal: a change at GİB goes unnoticed until the emulator follows it.
