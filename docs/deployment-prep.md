# Bela Viva Deployment Prep

## Target

This version is prepared for a Vercel deployment, but it still uses simulated payment. Do not connect real payment credentials until the Mercado Pago Checkout Pro and webhook phase is implemented.

## Required environment variables

- `DATABASE_URL`: PostgreSQL connection string for the target environment.
- `SESSION_SECRET`: long random value used to sign admin cookies.
- `ADMIN_EMAIL`: seed admin email for local or preview setup.
- `ADMIN_PASSWORD`: seed admin password for local or preview setup.
- `NEXT_PUBLIC_SITE_URL`: canonical public URL, for metadata, robots, and sitemap.

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
- Run CSV imports only from the admin area.
- Use the simulated payment page to validate order and inventory behavior until real payment is connected.
