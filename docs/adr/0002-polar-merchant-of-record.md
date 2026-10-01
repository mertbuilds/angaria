# 0002. Polar as merchant of record and license keys

Accepted, 2026-10-01.

## Context

Angaria is a paid subscription, yearly or monthly, sold to Turkish freelancers and to buyers abroad. Selling it means sales tax, receipts and card payments. The app has no server of its own, so it must check a license without shipping a secret.

## Decision

Polar is the merchant of record, under a new Vinena Studio org. One product per billing interval: yearly (1,499 TRY) and monthly (199 TRY), each with a TRY price, a USD price and a 14-day free trial (Polar subscription trial). Both products grant the same license key benefit, so a key works the same whichever plan bought it, and the app never needs to know the plan. The site has one checkout link per plan; the app's Satın al opens the yearly one. The app uses Polar license keys through the customer-portal `activate` and `validate` endpoints, which need no org token. A key activates at most 3 devices. The app validates on every launch; when Polar cannot be reached it keeps working for 7 days after the last successful validation. An invalid, expired or canceled key locks the app to the license screen. The org id and the Polar environment are build-time `VITE_POLAR_*` config.

## Consequences

- Polar handles tax, receipts and checkout; card data never reaches us.
- The license key validation does not say which plan a key came from, so the app shows no plan name.
- Polar is one of the hosts the app talks to, and the privacy section lists it.
- A device offline for more than 7 days locks until it reaches Polar again.
- Development uses the Polar sandbox; a production build fails without the production values.
