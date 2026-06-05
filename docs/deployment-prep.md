# RosaGiro Deployment Prep

## Target

This version is prepared for a Vercel deployment and supports simulated payment plus Mercado Pago Checkout Pro sandbox. Do not use live Mercado Pago credentials until the store is ready for real sales.

## Required environment variables

- `DATABASE_URL`: PostgreSQL connection string for the target environment.
- `SESSION_SECRET`: long random value used to sign admin cookies.
- `ADMIN_EMAIL`: seed admin email for local or preview setup.
- `ADMIN_PASSWORD`: seed admin password for local or preview setup.
- `NEXT_PUBLIC_SITE_URL`: canonical public URL, for metadata, robots, and sitemap.
- `GOOGLE_MAPS_API_KEY`: optional server-side key for checkout address suggestions and address validation. If empty, checkout falls back to CEP/manual address entry.
- `PRODUCT_IMAGE_STORAGE`: keep `local` for the first admin upload version. Replace with persistent object storage before live Vercel sales.
- `PAYMENT_MODE`: `simulated` for local fallback, or `mercado_pago_sandbox` for Checkout Pro sandbox.
- `MERCADO_PAGO_ACCESS_TOKEN`: sandbox access token from the Mercado Pago seller test account.
- `MERCADO_PAGO_WEBHOOK_SECRET`: webhook secret from the Mercado Pago application. Required for webhook processing.

## Payment notes

- If `PAYMENT_MODE` is `simulated`, or the Mercado Pago access token/site URL is missing, Pix and card choices fall back to the local simulated payment page.
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
- Complete store identity, public policies, real catalog data, persistent image storage, freight rules, Mercado Pago sandbox, production deployment, SEO checks, full black-box purchase QA, and a controlled soft launch in that order.
- Keep the detailed operator checklist in `docs/prelaunch-checklist.md`.

## Operational notes

- Keep `.env.local` local and never commit it.
- Restrict `GOOGLE_MAPS_API_KEY` in Google Cloud to the required Maps APIs before production use.
- Use Mercado Pago test seller/buyer accounts for sandbox. Never put live tokens in `.env.example` or source files.
- Run CSV imports only from the admin area.
- Product images uploaded locally are written to `public/uploads/products` and ignored by git. Move real product media to S3/R2/Vercel Blob or another persistent storage before production selling.
- Import Anjun freight tables only through `/admin/frete`; keep original XLSX files local and out of git.
- Freight is simulated from imported D2D Pickup rates. No real carrier API, label purchase, insurance, or tax automation runs in this phase.
- Use the simulated payment page to validate order and inventory behavior when sandbox credentials are unavailable.
