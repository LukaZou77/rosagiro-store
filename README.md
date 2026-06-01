# Bela Viva Store

Next.js + Prisma + PostgreSQL ecommerce workspace for a Brazilian Portuguese multibrand beauty store.

## Run locally

```powershell
npm install
npm run db:generate
npm run db:migrate
npm run db:seed
npm run dev
```

Open:

- Storefront: `http://127.0.0.1:3000`
- Admin: `http://127.0.0.1:3000/admin`
- Prisma Studio: `npm run db:studio`

## Environment

Copy `.env.example` to `.env.local` and fill local values. Keep real passwords and tokens out of git.

Required:

- `DATABASE_URL`
- `SESSION_SECRET`
- `ADMIN_EMAIL`
- `ADMIN_PASSWORD`
- `NEXT_PUBLIC_SITE_URL`

Reserved for the later payment phase:

- `PAYMENT_MODE`
- `MERCADO_PAGO_ACCESS_TOKEN`
- `MERCADO_PAGO_WEBHOOK_SECRET`

## Product import

Admins can import products at `/admin/importar-produtos`.

Required CSV fields:

`slug,name,brand,category,subcategory,price,stock,active,image,descriptionPt`

Optional CSV fields:

`compareAtPrice,benefits,ingredients,badges,skinType,finish,volume,weightGrams,rating,reviewCount`

Use `docs/product-import-template.csv` as a starting template. The importer previews and validates rows before writing to the database, then creates or updates products by `slug`.

## Freight simulation

Admins can import the Anjun 2026 workbook at `/admin/frete`. The first version reads only the `D2D Pickup` sheet, stores structured CEP and weight-rate rows in PostgreSQL, and quotes checkout freight from `SP-Sao Paulo`.

No carrier API is called and no shipping label is purchased. Insurance, ICMS/ISS, risk-area fees, transportadora, and excursao remain manual confirmation notes.

## Verification

```powershell
npm run typecheck
npm run lint
npm run build
npx prisma validate
```

Deployment notes live in `docs/deployment-prep.md`.
