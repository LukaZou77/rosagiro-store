# RosaGiro measurement and order-access follow-up

## Authorization and scope

- User authorized completion, assistant review, and production deployment after verification.
- User explicitly approved publishing the three revised buying guides without public AI/Codex labels. This supersedes the earlier draft-only publication condition; internal review provenance remains in `guide-review-2026-09-26.md`.
- Latest instruction: release the website and GA4 only; defer Google Ads conversion-goal changes. No ad budget, bidding, campaign, or conversion-action changes are included.
- Isolated release base: `64f029b66ed69cc31f75ef489c12cf4d4aa7b018`. Unrelated root-worktree changes are excluded.
- No inventory, product prices, product purchase gates, customer orders, payments, or outbound customer messages were changed or created.

## Delivered changes

- Explicit opt-in before Google tags load; equal allow/refuse controls, permanent privacy settings, DNT/GPC protection, and sanitized page/referrer URLs.
- Consent banner avoids fixed mobile navigation and remains scrollable on short viewports.
- GA4 uses manually controlled page views; enhanced measurement is disabled in the stream. Purchase events still require actual persisted payment confirmation and per-channel deduplication.
- Order details require an order-scoped signed capability or an authenticated admin session. Admin-issued share links expire after 15 minutes and exchange for a 30-day HttpOnly order cookie. Plain order numbers and customer identity form values are not authorization.
- Live Mercado Pago orders cannot be marked paid by the simulation endpoint.
- WhatsApp clicks receive a random inquiry reference. Administrators can associate a real conversation with its click and an actual paid order. Clicks, leads, and paid revenue remain separate; expired click retention does not erase linked attribution snapshots.
- Public guide review is attributed to RosaGiro without claiming a human performed the review.

## External state read-back

- GA4 account `409578915`, property `556044604`, stream `15849714989`, measurement ID `G-XHSC1B250B`.
- Confirmed account: `marburywalker543@gmail.com`. Brazil, Sao Paulo timezone, BRL, business size 11-100. Optional data sharing and marketing emails disabled.
- Google Ads link to `792-679-4299` is saved and visible in the completed-links table. Personalized advertising and embedded Analytics access for Ads users are disabled; existing auto-tagging behavior was preserved.
- Production additive migration `20260926113000_whatsapp_inquiry_order_linkage` applied before code deployment. Prisma reports 38 migrations and database up to date.
- Three guides read back active, published at `2026-09-26T14:21:25.382Z`, with all exact target hashes matching. A second dry run reports `already-published`, changed count zero.

## Verification

- Automated regression suite: 180 passed, zero failed. TypeScript and full ESLint passed. Default Next.js/Turbopack production build passed with the production GA4 ID present; final receipts are recorded in the output release report.
- Late consent resumes the bounded purchase retry lifecycle, including cross-tab opt-in. Revocation in another tab unloads already-loaded tags; no overlapping purchase retry chains are created.
- Browser QA at 390x844 and 1280x900: consent controls visible and operable; no horizontal overflow. Mobile banner ends at y=704 and navigation starts at y=776.
- Browser consent flow: no Google script before consent or after refusal; explicit grant loads the tag; withdrawal reloads with no Google script.
- Anonymous order URL renders only a neutral secure-link request, without querying or disclosing order details.
- Optional legacy Webpack build fails on an existing global selector in admin print CSS, as documented in the prior release. The repository production command uses the passing default Turbopack build; unrelated print code was not changed.

## Limits

- No fabricated purchase, lead, payment, or advertising conversion was generated for verification. Client-side purchase measurement requires the customer to visit the paid order page and permit measurement.
- Google Ads purchase action/import, changes to the current primary WhatsApp-click goal, and advertising-account optimization are deferred by the user.
- Search Console / Merchant Center account audits, real-user Core Web Vitals, and remaining unverified catalog duplicates are not claimed complete by this follow-up.
- Production readiness, aliases, actual page content, and GA4 network collection must be read back after deployment; a local build is not deployment evidence.
