# Website payment excludes freight

Effective policy requested by Luka on 2026-09-25:

- Collect only the product subtotal (less any server-calculated discount) on the website.
- Preserve the R$500 product minimum, complete-package rules, stock checks and delivery address.
- No carrier quote or shipping-method selection is required for payment.
- The customer explicitly accepts the separate-freight notice before submitting payment.
- Staff calculate freight from the actual package weight/dimensions, obtain customer approval and collect it outside the website.

New orders use existing database fields: `shippingMethod=PADRAO`, `shippingQuoteStatus=SEPARATE_PAYMENT`, `shippingCents=0`. This zero is the amount collected on the website, **not free shipping**. The snapshot records an unknown freight amount (`null`), the notice version and server-side acceptance time. No schema migration is required.

The retired `/api/shipping/quote` endpoint returns HTTP 410 with the current policy and does not contact a carrier. Old browser tabs must reload before proceeding. Existing orders and payment preferences keep their saved amounts.

The customer order page, Mercado Pago preference and admin order page distinguish product payment from freight collected separately. Admin freight/readiness pages no longer require Melhor Envio for checkout. Existing Melhor Envio credentials/configuration are not modified.

## Verification

Run from the release checkout:

```text
node --experimental-test-module-mocks --import tsx --import ./scripts/test-server-only.mjs --test ./lib/separate-freight-checkout.test.ts ./lib/wholesale-order.test.ts ./lib/admin-i18n.test.ts
npm run typecheck
npm run lint
npm run db:validate
npm run build
git diff --check
```

The regression tests mock the database and external APIs; they must not create live orders or payment preferences. Verify production deployment/aliases, the visible freight notice, and the retired endpoint after release. A real card charge is not part of this non-charging verification.

The production database has editable shipping-policy text (`SiteInfoPage.shipping`) and `StoreProfile.shippingNote`; these must also match the separate-freight policy. Preserve unrelated delivery/return conditions when updating them.
