# RosaGiro storefront remediation - 2026-09-26

## Release boundary

- Authorized: non-inventory SEO, purchase clarity, pickup information and analytics fixes; production deployment after verification.
- Production base: aa8eeb5e7fcdda64d7fd161ba4b5be4389c85493.
- Isolated worktree: .codex-staging/storefront-remediation-20260926.
- Unrelated root worktree edits are excluded. No inventory, SKU, purchase gate, legal identity, shipping origin or payment amount rules changed.

## Changes

- Show authoritative package totals, package quantity and reference unit price together. Move product buying actions ahead of long descriptions; preserve all existing purchase checks.
- Remove missing-brand placeholder text from customer product names and metadata without renaming database products.
- Use confirmed pickup location: LA BELLA, Rua Paula Sousa, 529, Box A01, Sao Paulo/SP. Keep the company's registered address separately labelled. Require prior pickup confirmation.
- Align cart and product copy with the production flow: website payment covers products only; customer service quotes and separately charges freight after approval.
- Replace conflicting support summary on the store information page with a link to the existing returns policy; do not rewrite legal rights.
- Product structured offers use package totals. Consultation-only or unknown-package products receive no invented offer.
- Canonicalize the individually verified Vivai 2172.1.1 duplicate to the supplier-catalog page, with active-product and commercial-term guards; align sitemap. Do not merge the unverified 217211-01 item or database/cart records.
- Purchase analytics requires persisted payment evidence, uses bounded status refresh, independent GA4/Ads destinations and channel deduplication. Retry briefly when gtag is not installed yet; absent configuration never counts as a successful send.

## Verification

- 61 focused tests passed, including 11 existing separate-freight checkout regression tests with mocked persistence/payment transport.
- Complete TypeScript check and ESLint passed.
- Default Next.js Turbopack production build passed, 61 static pages generated.
- Optional legacy Webpack build failed on an existing global selector in admin print CSS; no unrelated print change was included. Production uses the default build.
- Browser: 390 x 844 and 1440 x 1000 CSS viewports; product/gallery/package-price layout checked, no horizontal overflow. Mobile category images loaded and package totals rendered.
- Anonymous Add-to-cart opens the existing customer identification dialog. No identity submitted, real order created, payment made or message sent.
- MYJ-0920 display name no longer contains the missing-brand prefix; its consultation status is unchanged.
- Draft script created exactly three missing GuideArticle rows. All three content hashes matched read-back; active=false and publishedAt=null. Existing articles were not overwritten.

## Pending / explicitly not claimed

- Buying guides remain unpublished until real human review in the admin.
- Before this release the public production page exposed Google Ads base tag AW-17323505855, but no GA4 tag. Local GA4 Measurement ID and Ads purchase destination are absent. Account configuration and actual collection require separate verification; no conversions or revenue lift claimed.
- Client purchase tracking only works while an order page is visited/open. It does not replace payment-provider/server analytics.
- WhatsApp inquiry-to-order linkage, Search Console / Merchant Center account findings, real-user Core Web Vitals and customer conversion measurements are not completed by this release.
- Existing order pages are accessible by order number; customer-scoped access control needs a separate design and migration. No new access API or customer-data fields were introduced here.
- Vivai 217211-01 identity and remaining catalog duplicates still require source-by-source review. No sitewide duplicate cleanup claimed.

Production alias/read-back evidence is recorded separately after deployment, not inferred from a local build.

## Production read-back follow-up

The first production read-back found that the source canonical page had no legacy descriptionPt and was therefore omitted by the historical sitemap query. Confirmed against database fields, not inferred from a crawler cache. The sitemap now explicitly admits the narrowly allowlisted canonical target while retaining active/image/positive-price requirements. A mocked query regression test verifies inclusion of the canonical page and exclusion of its duplicate. No product data was changed.
