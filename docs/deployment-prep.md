# RosaGiro Deployment Prep

## Target

This version is prepared for a Vercel deployment and supports simulated payment, Mercado Pago Checkout Pro sandbox, and Mercado Pago Checkout Pro live. Do not add live Mercado Pago credentials until the store is ready for real sales.

## Required environment variables

- `DATABASE_URL`: PostgreSQL connection string for the target environment.
- `SESSION_SECRET`: long random value used to sign admin cookies.
- `ADMIN_EMAIL`: seed admin email for local or preview setup.
- `ADMIN_PASSWORD`: seed admin password for local or preview setup.
- `NEXT_PUBLIC_SITE_URL`: canonical public URL, for metadata, robots, and sitemap.
- `GOOGLE_MAPS_API_KEY`: optional server-side key for checkout address suggestions and address validation. If empty, checkout falls back to CEP/manual address entry.
- `PRODUCT_IMAGE_STORAGE`: use `local` for local development and `vercel_blob` for Vercel production uploads.
- `BLOB_READ_WRITE_TOKEN`: required when `PRODUCT_IMAGE_STORAGE=vercel_blob`. Create a public Vercel Blob store and add this token only in Vercel/local env files, never in source.
- `PAYMENT_MODE`: `simulated` for local testing, `mercado_pago_sandbox` for Checkout Pro sandbox, or `mercado_pago_live` for real payments.
- `MERCADO_PAGO_ACCESS_TOKEN`: sandbox or live access token from the Mercado Pago application. Keep it only in Vercel/local secret env files.
- `MERCADO_PAGO_WEBHOOK_SECRET`: webhook secret from the Mercado Pago application. Required for webhook processing and live payments.

## Payment notes

- If `PAYMENT_MODE` is `simulated`, Pix and card choices use the local simulated payment flow.
- If `PAYMENT_MODE` is `mercado_pago_sandbox` or `mercado_pago_live`, missing token/site URL blocks Mercado Pago checkout instead of silently falling back to simulated payment.
- In `mercado_pago_live`, `MERCADO_PAGO_WEBHOOK_SECRET` is required before creating real customer payments.
- Mercado Pago Checkout Pro uses a server-created preference with one summary item for the server-computed order total.
- Webhooks are accepted only when `MERCADO_PAGO_WEBHOOK_SECRET` validates the `x-signature`/`x-request-id` manifest.
- A public HTTPS `NEXT_PUBLIC_SITE_URL` is needed for Mercado Pago to reach `/api/webhooks/mercado-pago`.

## Local verification

```powershell
npm run typecheck
npm run lint
npm run build
npx prisma validate
```

## Database setup

For a fresh database:

```powershell
npx prisma migrate deploy
npm run db:seed
```

For local development:

```powershell
npm run db:migrate
npm run db:seed
```

## Prelaunch sequence

- Use `/admin/prontidao` as the operating control center before real sales.
- Complete store identity, public policies, real catalog data, persistent image storage, freight rules, Mercado Pago sandbox, Mercado Pago live validation, production deployment, SEO checks, full black-box purchase QA, and a controlled soft launch in that order.
- Keep the detailed operator checklist in `docs/prelaunch-checklist.md`.

## Operational notes

- Keep `.env.local` local and never commit it.
- Restrict `GOOGLE_MAPS_API_KEY` in Google Cloud to the required Maps APIs before production use.
- Use Mercado Pago test seller/buyer accounts for sandbox. Never put sandbox or live tokens in `.env.example` or source files.
- Run CSV imports only from the admin area.
- Product images uploaded locally are written to `public/uploads/products` and ignored by git. Production uploads should use Vercel Blob so product photos survive deploys and rebuilds.
- Import Anjun freight tables only through `/admin/frete`; keep original XLSX files local and out of git.
- Freight is simulated from imported D2D Pickup rates. No real carrier API, label purchase, insurance, or tax automation runs in this phase.
- Use the simulated payment page only for local/test validation. It must not be exposed as the official customer payment method when `PAYMENT_MODE=mercado_pago_live`.
