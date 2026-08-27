# Technology Stack

**Analysis Date:** 2026-08-28

## Languages

**Primary:**
- JavaScript (ES2022+, JSDoc-typed, `.mjs`/`.js`/`.jsx`) — entire `src/` tree

**Secondary:**
- TypeScript — used only for typechecking config (`tsc --noEmit` over `jsconfig.json` with `checkJs: true`); no `.ts` app source files, though Prisma generates typed client code to `src/generated/prisma/`

## Runtime

**Environment:**
- Node.js 24, pinned via `mise` (`mise.toml`: `[tools] node = "24"`) — ships npm 11 natively

**Package Manager:**
- npm (lockfile: `package-lock.json` present)
- Dependency freshness script: `npm run update:safe` → `npx npm-check-updates --cooldown 7d -u && npm install`

## Frameworks

**Core:**
- Next.js 16.2.12 (App Router) — `next.config.mjs`, `output: 'standalone'`, React Compiler enabled (`reactCompiler: true`)
- React 19.2.8 / React DOM 19.2.8
- Tailwind CSS 4.3.3 (`@tailwindcss/postcss`) — `@theme` design tokens in `src/app/layout.css`
- MDX via `@next/mdx` + `@mdx-js/react` + `@mdx-js/loader` (`pageExtensions: ['js', 'jsx', 'mdx']`), `remark-gfm` for GFM support — used for `/docs` content

**Testing:**
- Vitest 4.1.10 — unit tests (`vitest run`), smoke tests (`vitest.smoke.config.mjs`, plain `fetch` against a running server), visual regression (`@vitest/browser` + `@vitest/browser-playwright`, Playwright 1.62.1 browser engine)
- `@testing-library/react`, `@testing-library/jest-dom`, `@testing-library/user-event` — component testing
- `@vitest/coverage-v8` — coverage reports

**Build/Dev:**
- `serwist` / `@serwist/next` / `@serwist/cli` 9.5.12 — PWA service worker generation (config: `serwist.config.js`, source `src/sw.js`, output `public/sw.js`, gitignored)
- `esbuild` 0.28.1 — devDependency (bundling support tooling)
- `chokidar-cli` — `npm run format` watch mode for Prettier
- `prettier` 3.9.6 + `prettier-plugin-tailwindcss` — formatting, class-order sorting
- `eslint` 10.8.0 (flat config, `eslint.config.mjs`) with `@eslint-react/eslint-plugin`, `@next/eslint-plugin-next`, `eslint-plugin-react-hooks`, `eslint-plugin-react-compiler`, `eslint-plugin-jsdoc`, `eslint-plugin-compat`, `eslint-plugin-prettier` (Prettier wired in as a lint rule)
- `babel-plugin-react-compiler` — React Compiler transform support

## Key Dependencies

**Critical:**
- `@prisma/client` 7.9.1 + `prisma` 7.9.1 CLI + `@prisma/adapter-pg` 7.9.1 — ORM and driver adapter for Postgres (config: `prisma.config.mjs`, schema `prisma/schema.prisma`, migrations `prisma/migrations/`, generated client output to `src/generated/prisma/`, gitignored)
- `zod` 4.4.3 — runtime validation for all external data (`src/validators/`)
- `@asteasolutions/zod-to-openapi` 9.1.0 — OpenAPI schema generation from Zod (`src/shared/utils/api/openapiRegistry.mjs`)
- `axios` 1.18.1 — used specifically because Node's native `fetch` cannot supply a custom `https.Agent` (needed to disable TLS cert validation against the official HD1 API, see `src/update/fetch.mjs`)
- `better-auth` 1.6.25 — authentication (optional; server config `src/auth.js`, client `src/auth-client.js`)
- `web-push` 3.6.7 — Web Push notification delivery
- `@sentry/nextjs` 10.68.0 — error tracking SDK (targets self-hosted GlitchTip)
- `dotenv` 17.4.2 — env loading in `prisma.config.mjs` (`.env.development` then `.env` fallback)

**Infrastructure:**
- `mermaid` 11.16.0 — interactive diagrams (`src/shared/components/MermaidDiagram/`), dynamically imported client-side only
- `recharts` 3.10.1 — charting (`ProgressExplainer` and dashboard stat visualizations)
- `sonner` 2.0.7 — toast notifications (`LiveToasts`)
- `react-slot-counter` 3.3.3 — animated number counters
- `humanize-duration` 3.34.0, `timeago.js` 4.0.2 — time formatting helpers

## Configuration

**Environment:**
- Progressive env-var model: only `POSTGRES_URL`, `UPDATE_KEY`, `UPDATE_INTERVAL` are strictly required; everything else (auth, analytics, error tracking, push, `BUCKET_SIZE`) degrades gracefully when absent
- `.example.env` documents every variable with section headers (`REQUIRED`/`OPTIONAL`) and inline rationale comments
- Build-time vs runtime vars distinguished: `NEXT_PUBLIC_*` vars are inlined at `next build` time (site URL, deploy env, VAPID public key, Sentry DSN, app version)

**Build:**
- `next.config.mjs` — MDX wrapper, conditional Sentry wrapper (only when `SENTRY_AUTH_TOKEN` set), security headers, cache-control rules per route type, redirects (`/war` → `/archives`, `/profile/admin` → `/profile`), rewrites (`/stats.js` → Umami script proxy, `/api/send` → `/api/umami`)
- `deploymentId` set from `package.json` version (dots replaced with dashes) — drives Next.js's built-in stale-chunk detection
- `jsconfig.json` — `@/*` → `./src/*` path alias, `@test-utils` alias, `checkJs: true` strict-null JSDoc typechecking with `noImplicitAny: false`
- `browserslist` in `package.json`: `defaults`, Firefox ≥115, Chrome ≥109, Safari ≥15.6, excludes dead/op_mini/kaios/android-browser
- `package.json` `overrides` block pins transitive deps (`postgres`, `better-sqlite3`, `sharp`, `valibot`, `brace-expansion`, `find-my-way`, and nested `prisma` overrides for `hono`/`@hono/node-server`/`effect`)

## Platform Requirements

**Development:**
- Node 24 (mise-pinned; untrusted mise silently falls back to Homebrew's version — verify with `node --version`)
- Local Postgres or Docker (`host.docker.internal`) reachable via `POSTGRES_URL`
- Dev server assumed already running on `:3000`

**Production:**
- Docker images: `Dockerfile.app` (main app, `output: 'standalone'` server at `.next/standalone/server.js`), `Dockerfile.migrate` (one-shot `prisma migrate deploy && seed.mjs` container)
- Deployed behind a service VIP with a Postgres-backed leader-election lease (only one instance polls the HD1 API); `WORKER_ENABLED="false"` on scaled web replicas, one dedicated 1-replica worker service
- Images published to `ghcr.io/elfensky/helldiversbot` (and `-migrate` variant), pulled by `docker-compose.yml` (staging in `deploy/staging/`)
- `docker-compose.ci.yml` builds from local source (not GHCR) for smoke-testing full boot path in CI

---

*Stack analysis: 2026-08-28*
