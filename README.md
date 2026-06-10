# RosaGiro Store

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
- `PRODUCT_IMAGE_STORAGE` (`local` for local development, `vercel_blob` for Vercel production uploads)
- `BLOB_READ_WRITE_TOKEN` (required when `PRODUCT_IMAGE_STORAGE=vercel_blob`)

Payment:

- `PAYMENT_MODE`
- `MERCADO_PAGO_ACCESS_TOKEN`
- `MERCADO_PAGO_WEBHOOK_SECRET`

Use `PAYMENT_MODE="simulated"` for local fallback. Use `PAYMENT_MODE="mercado_pago_sandbox"` only with Mercado Pago test credentials and a suitable `NEXT_PUBLIC_SITE_URL`. Live credentials are not part of this baseline.

## Product import

Admins can import products at `/admin/importar-produtos`.

Required CSV fields:

`slug,name,brand,category,subcategory,price,stock,active,image,descriptionPt`

Optional CSV fields:

`compareAtPrice,gallery,benefits,ingredients,badges,skinType,finish,volume,weightGrams,suggestedQuantity,kitRecommendation,wholesalePackage,validityNote,purchaseNote,rating,reviewCount`

Use `gallery` with up to 6 image paths separated by `|`. Use the wholesale fields to guide revenda/reposition purchases; they do not create automatic discounts or change checkout totals. Local admin uploads are saved under `/uploads/products/...`; production uploads should use Vercel Blob with `PRODUCT_IMAGE_STORAGE=vercel_blob`.

Use `docs/product-import-template.csv` as a starting template. The importer previews and validates rows before writing to the database, then creates or updates products by `slug`.

## Freight simulation

Admins can import the Anjun 2026 workbook at `/admin/frete`. The first version reads only the `D2D Pickup` sheet, stores structured CEP and weight-rate rows in PostgreSQL, and quotes checkout freight from `SP-Sao Paulo`.

No carrier API is called and no shipping label is purchased. Insurance, ICMS/ISS, risk-area fees, transportadora, and excursao remain manual confirmation notes.

## Payment sandbox

Checkout keeps the local simulated payment page as a test backdoor. When Mercado Pago sandbox variables are configured, Pix and card choices create a server-side Checkout Pro preference and redirect to Mercado Pago. Webhooks update local payment/order status only after signature validation and a server-side payment lookup.

## Verification

```powershell
npm run typecheck
npm run lint
npm run build
npx prisma validate
```

Deployment notes live in `docs/deployment-prep.md`.
