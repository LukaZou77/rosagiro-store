# RosaGiro Independent Store Handoff

## Project Direction

- Site name: RosaGiro.
- Market: Brazil.
- Language: Brazilian Portuguese.
- Category: multibrand beauty and cosmetics independent store.
- Current stack: Next.js App Router, TypeScript, Prisma, PostgreSQL.
- Current stage: local first-party ecommerce baseline with simulated payment and admin operations.

## Current Application

- Storefront pages: home, categories, product detail, cart, checkout, simulated payment, order confirmation.
- Admin pages: login, dashboard, products, CSV product import, orders, order detail.
- Database-backed content: brands, categories, products, inventory, orders, order items, payments, admin users.
- Checkout localization: CPF, CEP, Brazilian address fields, Pix, credit card, simulated payment choice, standard and express shipping.
- Product import: CSV upload from `/admin/importar-produtos`, with preview validation before writing products and inventory.

## Environment Status

- PostgreSQL runs locally on port `5432`.
- Local database: `bela_viva_dev`.
- Local app URL: `http://127.0.0.1:3000`.
- Admin URL: `http://127.0.0.1:3000/admin`.
- Required environment variables are documented in `.env.example`.

## Repository Status

- Branch: `main`.
- The old prototype has been replaced by the Next.js application.
- Runtime product SVGs live under `public/assets/products`.
- Generated Prisma client output under `src/generated/prisma` is ignored by git.

## Next Decisions

- Decide when to connect Vercel preview and a remote PostgreSQL database.
- Decide when to implement real Mercado Pago Checkout Pro and webhook validation.
- Prepare real business assets: domain, logo, company/legal data, real policies, support channels, product media.
- Replace seed products with real catalog data through the CSV import flow.
