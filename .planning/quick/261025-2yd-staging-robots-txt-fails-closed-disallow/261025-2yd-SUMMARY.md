---
phase: quick-261025-2yd
plan: 01
subsystem: seo
tags: [robots, deploy-env, staging]
status: complete
requirements: [SEO-03]
key-files:
    created:
        - src/app/robots.js
        - src/__tests__/unit/app/robots.test.mjs
    modified:
        - .example.env
        - src/app/docs/infrastructure/page.mdx
    deleted:
        - src/app/robots.txt
actuals:
    tokens: 6000
    tasks: 2
    commits: 2
plan_head_before: 3e20d232
plan_head_after: 2a0d52cd67abb43971466cfda5c0002cc26e8a6c
---

# Quick 261025-2yd: robots.txt fails closed

`src/app/robots.js` replaces the static `robots.txt`. Only a build with `NEXT_PUBLIC_DEPLOY_ENV=production` allows crawlers and lists the sitemap. Any other build disallows all.

## Commits

- `bf3b084a` fix(seo): robots.txt fails closed — only a production build is crawlable
- `2a0d52cd` docs: NEXT_PUBLIC_DEPLOY_ENV also gates robots.txt

## Verification (both commits: lint, typecheck, test:unit, build all exit 0)

- test:unit: 195 files, 2032 tests passed on both trees.
- Build needed the non-secret dummies `POSTGRES_URL=postgresql://user:pass@localhost:5432/db UPDATE_KEY=dummy UPDATE_INTERVAL=20` (without them it fails with `POSTGRES_URL is not set` while collecting `/opengraph-image`). `/robots.txt` shows as static (prerendered).
- Prerendered body, `.next/server/app/robots.txt.body` (variable unset):
  ```
  User-Agent: *
  Disallow: /
  ```
  No sitemap line.
- Docs gates: mdx cell width 193 and mentions robots.txt; `.example.env` names both workflow files, no stale `.docker.yml`, both variable lines unchanged.

## Deviations

None. `lint:fix` changed no file outside the plan. Prettier was not run on the mdx file.

## Known Stubs

None.

## Self-Check: PASSED
