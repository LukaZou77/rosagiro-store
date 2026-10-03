# Focused storefront performance pass — 2026-10-03

## Scope

Release source: `.codex-staging/remove-google-measurement-20260929`, baseline `b00d190d1ebdec876533b03022b2d404f0976fe5`. Preserve the accompanying security patch and do not deploy the unrelated root checkout.

This pass addresses redundant cart requests, a query waterfall, and high-frequency product-gallery work. It does not change prices, inventory, order/payment behavior, URLs, SEO metadata, or crawler policy. Live cart validation remains uncached.

## Implementation

- The quick-purchase drawer requests its summary only when open and nonempty. Closing, changing the cart, or starting a newer request cancels/isolates stale responses. Each open starts a fresh display cycle.
- Event and floating-button entry share the same fresh-cycle handler. The drawer traps Tab at its boundaries and restores focus on close, with a main-content fallback when the opener has unmounted.
- Cart validation and recommendation database queries start together, with only the product/relation fields their existing logic needs. Legacy package-description parsing, active-SKU stock fallback, consultation status and recommendation ordering are preserved.
- Gallery zoom caches geometry between invalidations and coalesces pointer positions into one animation-frame update. Leaving, changing images, opening the lightbox, scrolling, resizing and unmounting cancel pending work. Touch and reduced-motion users do not receive hover zoom.

## Before/after evidence

Local production builds on loopback port 3108, same browser and same synthetic local cart (one 36-unit package of `iluminador-facial-compacto-celestial-shine-ruby-rose-hb-m701`). Analytics requests were blocked in the test browser. No customer identity, order, payment, refund or inventory write was submitted.

| Controlled check | Before | After |
| --- | ---: | ---: |
| Homepage, nonempty cart, drawer closed: summary requests | 1 | 0 |
| Enter cart page: additional summary requests | 2 | 1 |
| 100 pointer moves in one frame: geometry reads | 100 | 1 |
| Same pointer burst: media-query reads | 200 | 2 |
| Same pointer burst: zoom CSS property writes | 200 | 2 |

Five sequential read-only local cart-summary requests in milliseconds:

- Before: 89, 53, 54, 59, 49; median **54 ms**.
- After: 218, 51, 36, 39, 39; median **39 ms**.

This tiny noninterleaved sample includes cold/warm and network variability; the first after request was slower. It is not a production latency SLA, field INP/LCP result, or proof that the whole site is 28% faster. The reduced request count, removed dependency waterfall (covered by a promise-barrier test), and reduced per-frame work are the stronger evidence.

## Regression and release gates

- Automated tests cover request admission/current-response guards, frame batching/cancellation, query concurrency, and full cart response shape across missing stock, inactive products, consultation products, invalid package multiples, legacy description parsing and recommendations.
- Browser checks cover drawer loading/close/reopen, summary amounts, gallery thumbnails, keyboard lightbox navigation and focus restoration, and reduced-motion behavior.
- Final combined regression suite: **246 passed, 0 failed**, with ESLint, TypeScript, Prisma schema validation and diff checks passing. Final production build generated **64 static pages**.
- A blocked summary request produced the expected error. After unblocking and adding 500 ms of test latency, reopening via the floating button immediately showed loading, not the old error, then the correct R$ 262,80 summary. Shift+Tab/Tab wrapped inside the drawer; Escape restored focus. Closing while a request was delayed produced `net::ERR_ABORTED` with `canceled: true`.
- Final gallery probe again produced 1/2/2 geometry/media/style operations. A primary touch event on a hover-capable desktop did **not** zoom. Reduced-motion mode also did not zoom. Desktop thumbnail selection, ArrowRight lightbox navigation and Escape focus return were verified.
- At an emulated 390 px viewport, document/lightbox widths were 390 px and the drawer was about 359 px, with no horizontal document overflow. This establishes narrow-layout fit, not physical-device touch performance; the browser controller's scaled mobile click coordinates were unreliable, so a complete mobile click-flow pass is not claimed.
- After the performance patch, **9/9 additional read-only crawler smoke assertions** passed on the final built app. These are UA routing simulations, not verified crawler identities or indexing guarantees.
- Temporary network/media/device overrides, the synthetic local cart and the test browser tab were cleared, and the local web server was stopped. No production writes were performed by the browser tests.
- Production migration was subsequently applied on 2026-10-03 after the owner's release authorization; application deployment is pending at the time of this source commit. See `docs/security-crawler-rollout-20261003.md` for preparation evidence. Deployment success requires a separate production read-back.
- Wider CSS splitting, persistent shell routing and additional catalog caching are intentionally outside this patch. Those require separate regression coverage and invalidation analysis, not speculative caching of inventory or checkout results.

## References

- [Next.js parallel data fetching](https://nextjs.org/docs/app/getting-started/fetching-data)
- [React effect cleanup and fetching](https://react.dev/reference/react/useEffect)
