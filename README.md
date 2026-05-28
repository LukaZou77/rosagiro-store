# Bela Viva Prototype

High-fidelity clickable prototype for a Brazilian Portuguese multibrand beauty store.

## Run

This workspace includes a Vite-style project scaffold. If npm dependencies are available, run:

```bash
npm install
npm run dev
```

This Codex environment does not expose npm, so the prototype also includes a no-install static server:

```bash
node tools/dev-server.mjs
```

## Data Template

Products live in `src/main.js` and use the planned import fields:

`id`, `brand`, `name`, `category`, `subcategory`, `priceBRL`, `compareAtPriceBRL`, `image`, `gallery`, `descriptionPt`, `benefits`, `ingredients`, `skinType`, `finish`, `volume`, `rating`, `reviewCount`, `stockStatus`, `badges`.

Brands use:

`id`, `name`, `logo`, `origin`, `descriptionPt`, `featured`, `categories`.
