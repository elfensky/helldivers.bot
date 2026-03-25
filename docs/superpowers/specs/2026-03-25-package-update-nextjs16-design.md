# Phase 1: Update All Packages + Next.js 16 Migration

**Date:** 2026-03-25
**Scope:** Update all dependencies to latest versions, migrate from Next.js 15 to Next.js 16
**Approach:** Incremental — update in dependency order, build-verify after each step

## Context

- Next.js 15.5.14 → 16.x (major version bump)
- React 19.2.4 → latest 19.x
- Prisma 7.5.0 → latest 7.x
- All other deps bumped to latest within current major
- Node 22 / npm 11 (unchanged)
- No test framework — verification is `npm run build` + dev server
- **Runtime:** nodejs only — no edge runtime is used anywhere in the codebase
- **Bundler:** Use Turbopack (Next.js 16 default) — no `--webpack` fallback

## Constraints

- Auth packages (`next-auth`, `@auth/prisma-adapter`) are temporary — Phase 2 replaces them with better-auth
- Database is being wiped, so no data migration concerns
- Docker build must continue to work (standalone output via `Dockerfile.app`)

## Execution Order

Each step: update `package.json` → `npm install` → fix breakage → `npm run build`. Fix before moving on.

### Step 1: Next.js 16 + React + Sentry + Codemod

**First action:** Run the official Next.js upgrade codemod to automate boilerplate changes:
```bash
npx @next/codemod@latest upgrade
```
This handles config migrations, middleware rename, and other mechanical changes automatically.

**Changes:**
- `next` → `^16.x`
- `react` / `react-dom` → latest `19.x`
- `@sentry/nextjs` → latest stable (must be done in same step — see Turbopack below)
- `next.config.mjs`: move `reactCompiler` from `experimental` to top-level config. Verify the exact syntax against Next.js 16 docs (may be `reactCompiler: true` at top level, or `compiler: { react: true }` — confirm before applying).
- Check if `babel-plugin-react-compiler` devDependency is still needed (Next.js 16 may bundle the compiler)
- **Delete `src/middleware.js`** — the current middleware is a complete no-op (empty function body). No edge runtime is used. Rather than migrating dead code to `proxy.js`, remove it entirely.
- Remove the unused `NextResponse` import that was only in middleware
- Verify `jsconfig.json` path aliases (`@/*` → `./src/*`) work under Turbopack builds

**Turbopack strategy:** Next.js 16 defaults to Turbopack for `next build`. The current `withSentryConfig` wrapper injects a `webpack` key, which will cause `next build` to **hard-fail** (explicit error, not silent). This must be resolved in the same step:
- Update `@sentry/nextjs` to latest stable
- Remove all Webpack-specific options from `withSentryConfig`: `disableServerWebpackPlugin`, `disableClientWebpackPlugin`, `hideSourceMaps`
- Remove the entire `webpack` key (`autoInstrumentServerFunctions`, `autoInstrumentMiddleware`, `autoInstrumentAppDirectory`, `treeshake`)
- Research Turbopack equivalents in the latest `@sentry/nextjs` docs. If none exist, strip `withSentryConfig` down to `{ silent: true }` only — the Sentry init files (`sentry.server.config.js`, `src/instrumentation-client.js`) handle initialization independently.

**Edge cleanup:**
- Remove `sentry.edge.config.js` — no edge runtime is used anywhere in the codebase
- Remove the `NEXT_RUNTIME === 'edge'` branch in `src/instrumentation.js` `register()`
- Remove the `'use server'` directive from `initializeHelldivers1Api()` in `src/instrumentation.js` — it's a server action directive in a non-server-action context and Next.js 16 may reject it

**Risk areas:**
- `output: 'standalone'` — verify still works under Turbopack
- `instrumentation.js` — verify `register()` + `onRequestError` pattern still works
- `@vercel/og` — hooks into Next.js internals, verify compatibility with Next.js 16
- `postcss.config.mjs` — verify `@tailwindcss/postcss` plugin still works
- Dev output directory may change to `.next/dev` (Next.js 16.1+) — cosmetic, but be aware

**Verification:** `npm run build` succeeds (Turbopack, no flags), `npm run dev` starts without errors.

### Step 2: Prisma + Auth Packages

**Why combined:** `@auth/prisma-adapter` has peer dependencies on `@prisma/client`. Bumping Prisma without simultaneously bumping the adapter can cause version mismatch errors.

**Changes:**
- `prisma` → latest `^7.x`
- `@prisma/client` → latest `^7.x`
- `@prisma/adapter-pg` → latest `^7.x`
- `next-auth` → latest `5.x` stable (currently on `5.0.0-beta.30`)
- `@auth/prisma-adapter` → latest compatible version. Check the `next-auth` changelog for adapter version compatibility — `@auth/prisma-adapter` v2.x may or may not be compatible with `next-auth` 5.x stable.

**Note:** Auth packages are minimal effort — these get replaced in Phase 2 (better-auth migration). Just need them working with Next.js 16. The beta-to-stable jump may have minor API changes, but usage in `src/auth.js` is straightforward.

**Risk:** Low-medium.

**Verification:** `npx prisma generate` succeeds, `npm run build` succeeds, OAuth login flow works.

### Step 3: All Remaining Dependencies

**Dependencies (latest within current major):**
- `@asteasolutions/zod-to-openapi` → latest `^8.x`
- `@vercel/og` → latest
- `axios` → latest `^1.x`
- `dotenv` → latest `^17.x` (note: `prisma.config.mjs` uses `import 'dotenv/config'` — verify this side-effect import still works)
- `humanize-duration` → latest `^3.x`
- `react-hook-form` → latest `^7.x`
- `react-icons` → latest `^5.x`
- `swagger-ui-dist` → latest `^5.x`
- `zod` → latest `^4.x` (already on v4, this is a minor/patch bump only)

**Zod migration note:** 8 source files use `import { z } from 'zod/v4'` — a non-standard import path. Audit and refactor these to `import { z } from 'zod'` before or during this step:
- `src/utils/openapi.registry.mjs`
- `src/validators/isValidStatus.js`
- `src/validators/isValidNumber.mjs`
- `src/validators/isValidFormData.js`
- `src/validators/isValidContentType.js`
- `src/db/queries/rebroadcast.mjs`
- `src/db/queries/api.mjs`

**Dev dependencies:**
- `@tailwindcss/postcss` → latest `^4.x`
- `chokidar-cli` → latest `^3.x`
- `prettier` → latest `^3.x`
- `prettier-plugin-tailwindcss` → latest `^0.x`
- `tailwindcss` → latest `^4.x`

**Risk:** Low-medium. Tailwind v4 is a new engine — even minor/patch releases may contain significant changes. Verify `postcss.config.mjs` still works after update.

**Verification:** `npm run build` succeeds, spot-check a page with Tailwind styles, `npx prettier --check .` works (note: `npm run format` is a chokidar watcher that never exits — don't use it for one-shot verification).

### Step 4: Config Updates & Cleanup

**`next.config.mjs`:**
- Confirm `reactCompiler` moved to top-level (done in Step 1)
- Confirm Sentry config stripped of Webpack options (done in Step 1)
- Remove any remaining deprecated options flagged during builds

**`package.json`:**
- Verify `"start": "node .next/standalone/server.js"` works with Next.js 16 Turbopack standalone output
- Remove `babel-plugin-react-compiler` if no longer needed
- Verify build script is just `next build` (no flags needed)

**Docker (`Dockerfile.app` and `Dockerfile.migrate`):**
- `Dockerfile.app`: verify `npm run build` works (uses standalone output, copies `.next/standalone`, `.next/static`, `public`)
- `Dockerfile.app`: verify `COPY --from=builder /app/.next/standalone ./` path is still correct — Turbopack may change standalone output structure
- `Dockerfile.app`: verify both local `start` script (`node .next/standalone/server.js`) and Docker `CMD` (`node server.js`) work
- `Dockerfile.app`: consider updating pinned `npm i -g npm@11.7.0` to match local Volta-pinned version
- `Dockerfile.migrate`: verify prisma migrate deploy still works
- `Dockerfile.migrate`: pin `@prisma/adapter-pg` and `dotenv` versions to prevent drift from app container (currently installed without version constraints)

**Verification:** Full `npm run build`, dev server starts, `npx prettier --check .` works, Docker build passes for both Dockerfiles.

## Out of Scope

- better-auth migration (Phase 2 — separate spec)
- Database schema changes
- New features or refactoring
- Test infrastructure
