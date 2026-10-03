# RosaGiro security and crawler rollout — 2026-10-03

## Scope and source

- Production baseline: `b00d190d1ebdec876533b03022b2d404f0976fe5`.
- Working copy: `.codex-staging/remove-google-measurement-20260929`, branch `codex/order-shipment-20260930`.
- The root checkout contains unrelated work and must not be used as the release source.
- Project: `rosagiro-store` / `prj_KTtVbWD3KJf5xPUF2Z88neRYiC75`.
- Team: `lukazou77s-projects` / `team_TSOIM885UvWrHbpqqZZXp0CN`.

This is a scoped hardening change, not a complete penetration test or a guarantee against copying publicly visible product information.

## Application changes

1. One crawler policy for `robots.txt` and Proxy. Google/Bing and the OpenAI, Claude and Perplexity search/user-fetch agents are not on the block list. GPTBot/ClaudeBot/CCBot and the existing commercial/training crawler restrictions remain.
2. A claimed search-engine User-Agent does **not** bypass scanner, origin, JSON or API rate checks. `robots.txt` GET/HEAD remains readable by all agents so they can discover the policy.
3. Existing per-process API throttling is explicitly a bounded backstop, not a distributed limit. Expired entries are swept and oldest entries evicted at capacity. A 429 includes `Retry-After` and `Cache-Control: no-store`.
4. Address autocomplete/place-details now match their actual POST methods. WhatsApp click recording has a bounded local limit as well.
5. Trusted client IPs use the Vercel ingress header, are validated, and normalize IPv6 spelling. Public requests with a missing IP do not share a global `unknown` bucket. A self-hosted production server must implement a trusted ingress policy before reusing forwarding headers.
6. Admin-login admission uses shared PostgreSQL counters before password verification: 40 attempts per IP and 8 per IP+normalized-email in 15 minutes. Keys are domain-separated HMACs, not plaintext IPs/emails. Success clears only the unchanged combination receipt, preserving the IP ceiling and newer concurrent attempts. Expired records have bounded daily cleanup. Do not release this code before applying `20261003150000_admin_login_rate_limit`. Rate-limit storage failure denies a new admin login; existing signed sessions are not invalidated.

No order, inventory, payment, refund, catalog price, auth-cookie, or webhook-signature logic is changed.

## WAF: staged only, not active

Read-back on 2026-10-03: three valid pending insertions, no prior active custom rules. All three exceeded-limit actions are **log**, never deny/challenge/bypass.

The initial draft returned by Vercel also includes its default `crs` entries (general/RCE/SQLi/XSS marked active with action log). Their effective managed-ruleset activation/billing has not been established from that legacy field alone. Review managed-rule settings in the dashboard before publishing; do not assume the three custom rules are the only pricing consideration. Final overview still reported `active: null`, no bypasses and Attack Mode disabled.

| Rule | Threshold | Draft ID |
| --- | --- | --- |
| Catalog GET/HEAD (`produto`, `categoria`, `marcas`, `promocoes`) | 600 per IP / 60 seconds | `rule_rosa_giro_catalog_burst_observe_hADFUP` |
| Selected commerce API POSTs | 600 per IP / 60 seconds | `rule_rosa_giro_commerce_api_burst_observe_cdGezO` |
| Admin-login POST | 60 per IP / 60 seconds | `rule_rosa_giro_admin_login_burst_observe_bB846a` |

Definitions: `security/waf-observe-rules.json`. These generous starting values are observation thresholds, not conclusions drawn from a traffic baseline. The catalog and commerce buckets are separate. Edge counters are shared across function instances but **per Vercel region**, not a strict worldwide counter.

The selected rules exclude payment webhooks, cron, robots/sitemap, static assets, checkout/cart pages and order-detail pages. They do not install an allow-all exception based on a spoofable bot name.

### Human publish and enforcement gates

1. Review the three changes in [the project's Firewall](https://vercel.com/lukazou77s-projects/rosagiro-store/firewall). Confirm the account's plan and the pricing shown by Vercel. Creating these drafts does not activate them.
2. **The owner publishes the log-only draft.** The assistant has not run `firewall publish` or enabled Attack Mode, managed AI blocking, or any system bypass.
3. Review real traffic in the dashboard. Do not describe unpublished rules as observing live traffic.
4. Before any catalog denial/challenge: prove how verified search/user-fetch agents are excluded using Vercel's verified-bot protections or maintained official network verification. UA strings alone are not identity. Never turn this catalog rate rule into a blanket production deny.
5. Enforce a reviewed rule in preview first, preserving a separate production log rule. Verify normal shopping, admin login, crawlers, static assets, and payment callbacks. Only then request a separate production enforcement decision.
6. Roll back false positives by staging log mode/disable and having the owner publish; do not disable platform DDoS protections.

Traffic views after publication:

- [Catalog](https://vercel.com/lukazou77s-projects/rosagiro-store/firewall/traffic?filter=rule_rosa_giro_catalog_burst_observe_hADFUP)
- [Commerce API](https://vercel.com/lukazou77s-projects/rosagiro-store/firewall/traffic?filter=rule_rosa_giro_commerce_api_burst_observe_cdGezO)
- [Admin login](https://vercel.com/lukazou77s-projects/rosagiro-store/firewall/traffic?filter=rule_rosa_giro_admin_login_burst_observe_bB846a)

Vercel lists rate limiting as usage-priced, with plan-specific inclusions/limits; its current table shows $0.50 per million allowed requests. Confirm region and account terms in the dashboard before publication. No subscription upgrade is authorized by this patch.

## Release sequence (not executed by this document)

1. Review only the scoped security files; preserve all unrelated working changes.
2. Run tests, TypeScript, ESLint, Prisma validation and production build.
3. After deployment approval, review and apply the additive login-counter migration to the verified production database, then verify migration status. Do not run destructive migrations or seed.
4. Deploy from the verified worktree, not the stale root checkout. Read back the deployment commit and production aliases.
5. Make low-volume read-only smoke requests to home, robots, sitemap and one product using representative Google, OpenAI, Claude and Perplexity UAs. These validate routing only, **not genuine crawler identity, index inclusion or AI citation**.
6. Do not submit live orders/payments or run load/brute-force tests on production. Validate backend login counters with a controlled staging database/test identity first.

Until those steps complete, code fixes and database-backed login protection must be reported as **local / not deployed**, and WAF counters as **unpublished drafts**.

## Verification record

- Security-stage regression suite: **223 passed, 0 failed** (including crawler policy, actual Next matcher, API guard, local rate-limit and admin admission core tests). After the accompanying performance and interaction fixes, the final combined suite passed **246 tests, 0 failures**; see `docs/performance-verification-20261003.md`.
- ESLint, TypeScript, Prisma schema validation and `git diff --check`: passed.
- Production build: passed; **64 static pages** generated. The first sandboxed attempt could not reach the catalog database (`EACCES`); the approved network-enabled retry succeeded. No migration was run by the build.
- Built application started temporarily on loopback: **19 read-only HTTP assertions passed**, covering Google/OpenAI/Claude/Perplexity access to public content, robots/sitemap discovery, a real product page, training-agent restrictions and scanner-path rejection. The temporary web server was closed. These UA simulations do not establish real bot identity, search index inclusion or AI citations.
- Isolated PostgreSQL 18 integration: **7 passed, 0 failed**. Covered the real migration/index, concurrent admission, the IP ceiling, expiry reset, conditional successful clear, cleanup/consume contention and fail-closed behavior when the table is absent. An initial raw timestamp parsing discrepancy in the local Sao Paulo database session was fixed by returning database-computed epoch-millisecond expiry tokens. The final production build was rerun after that fix and passed. The empty local test cluster was stopped and removed; no production migration ran.
- Reusable integration harness: `scripts/test-admin-login-postgres.ts`, run with `node --experimental-test-module-mocks --import ./scripts/test-server-only.mjs --import tsx --test scripts/test-admin-login-postgres.ts`. It is deliberately restricted to a disposable loopback PostgreSQL instance on port 55439, role `security_test`, database `postgres`; it creates/drops only its test table after verifying that identity and never reads project connection variables.
- Release preparation on 2026-10-03: production migration `20261003150000_admin_login_rate_limit` was applied after the owner's release authorization. Prisma reports all 40 migrations up to date; the migration checksum matches the reviewed SQL and the new relation is present. The Neon branch connector did not return, so the isolated PostgreSQL integration evidence above was used as the fallback; no production branch test is claimed.
- At the time of this source commit, application deployment is pending and WAF publication remains **not executed**. Deployment completion must be established separately by the production alias and runtime read-back, not this preparation document.

## Official references

- [Vercel bot management and verified bots](https://vercel.com/docs/bot-management)
- [Vercel rate limiting](https://vercel.com/docs/vercel-firewall/vercel-waf/rate-limiting)
- [Vercel WAF pricing](https://vercel.com/docs/vercel-firewall/vercel-waf/usage-and-pricing)
- [Vercel trusted ingress headers](https://vercel.com/docs/headers/request-headers)
- [OpenAI crawler purposes](https://developers.openai.com/api/docs/bots)
- [Perplexity crawler purposes](https://docs.perplexity.ai/docs/resources/perplexity-crawlers)
