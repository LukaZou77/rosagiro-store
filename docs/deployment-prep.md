# Bela Viva Deployment Prep

## Target

This version is prepared for a Vercel deployment, but it still uses simulated payment. Do not connect real payment credentials until the Mercado Pago Checkout Pro and webhook phase is implemented.

## Required environment variables

- `DATABASE_URL`: PostgreSQL connection string for the target environment.
- `SESSION_SECRET`: long random value used to sign admin cookies.
- `ADMIN_EMAIL`: seed admin email for local or preview setup.
- `ADMIN_PASSWORD`: seed admin password for local or preview setup.
- `NEXT_PUBLIC_SITE_URL`: canonical public URL, for metadata, robots, and sitemap.
- `GOOGLE_MAPS_API_KEY`: optional server-side key for checkout address suggestions and address validation. If empty, checkout falls back to CEP/manual address entry.

## Reserved payment variables

- `PAYMENT_MODE`: keep as `simulated` for this phase.
- `MERCADO_PAGO_ACCESS_TOKEN`: leave empty until real Mercado Pago integration.
- `MERCADO_PAGO_WEBHOOK_SECRET`: leave empty until webhook validation exists.

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

## Operational notes

- Keep `.env.local` local and never commit it.
- Restrict `GOOGLE_MAPS_API_KEY` in Google Cloud to the required Maps APIs before production use.
- Run CSV imports only from the admin area.
- Import Anjun freight tables only through `/admin/frete`; keep original XLSX files local and out of git.
- Freight is simulated from imported D2D Pickup rates. No real carrier API, label purchase, insurance, or tax automation runs in this phase.
- Use the simulated payment page to validate order and inventory behavior until real payment is connected.
