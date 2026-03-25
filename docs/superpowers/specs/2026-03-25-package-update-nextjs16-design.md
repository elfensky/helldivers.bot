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

## Constraints

- Auth packages (`next-auth`, `@auth/prisma-adapter`) are temporary — Phase 2 replaces them with better-auth
- Database is being wiped, so no data migration concerns
- Docker build must continue to work (standalone output via `Dockerfile.app`)

## Execution Order

Each step: update `package.json` → `npm install` → fix breakage → `npm run build`. Fix before moving on.

### Step 1: Next.js 16 + React + Codemod

**First action:** Run the official Next.js upgrade codemod to automate boilerplate changes:
```bash
npx @next/codemod@latest upgrade
```
This handles config migrations, middleware rename, and other mechanical changes automatically.

**Changes:**
- `next` → `^16.x`
- `react` / `react-dom` → latest `19.x`
- `next.config.mjs`: move `reactCompiler` from `experimental` to top-level config
- Check if `babel-plugin-react-compiler` devDependency is still needed (Next.js 16 may bundle the compiler)
- Rename `src/middleware.js` → `src/proxy.js` (Next.js 16 renames the middleware convention). Update the exported function name from `middleware` to `proxy` and review `config.matcher` for compatibility. The codemod may handle this automatically.

**Turbopack build strategy:** Next.js 16 defaults to Turbopack for `next build`. The current `withSentryConfig` wrapper injects a `webpack` key, which will cause `next build` to fail. To unblock Step 1 verification:
- Temporarily update `package.json` build script to `next build --webpack`
- This keeps the build working while Sentry is addressed in Step 2
- The `--webpack` flag will be removed in Step 2 after Sentry config is updated

**Risk areas:**
- `output: 'standalone'` — verify still works
- `instrumentation.js` — verify `register()` + `onRequestError` pattern still works
- Dev output directory may change to `.next/dev` (Next.js 16.1+) — cosmetic, but be aware

**Verification:** `npm run build --webpack` succeeds, `npm run dev` starts without errors.

### Step 2: Sentry SDK + Turbopack Migration

**Changes:**
- `@sentry/nextjs` → latest stable
- Update `withSentryConfig` in `next.config.mjs`:
  - Remove Webpack-specific options: `disableServerWebpackPlugin`, `disableClientWebpackPlugin`, `hideSourceMaps`
  - Remove or replace the `webpack` key (`autoInstrumentServerFunctions`, `autoInstrumentMiddleware`, `autoInstrumentAppDirectory`, `treeshake`)
  - Research Turbopack equivalents in the latest `@sentry/nextjs` docs. If Turbopack-compatible options exist, use them. If not, keep `--webpack` flag and pin Sentry version.
- Verify `sentry.server.config.js`, `sentry.edge.config.js`, and `src/instrumentation-client.js` still work
- Once Sentry config is Turbopack-compatible, remove `--webpack` from the build script to use Turbopack (the default)

**Fallback:** If `@sentry/nextjs` does not yet fully support Turbopack, keep `--webpack` in the build script and pin the Sentry SDK to the latest Webpack-compatible version. This is acceptable — Turbopack migration can happen when Sentry catches up.

**Risk:** High — Sentry is tightly coupled to the bundler.

**Verification:** `npm run build` succeeds (ideally without `--webpack`), no Sentry errors in dev console.

### Step 3: Prisma Ecosystem

**Changes:**
- `prisma` → latest `^7.x`
- `@prisma/client` → latest `^7.x`
- `@prisma/adapter-pg` → latest `^7.x`

**Risk:** Low — same major version, minor/patch bumps only.

**Verification:** `npx prisma generate` succeeds, `npm run build` succeeds.

### Step 4: Auth Packages

**Changes:**
- `next-auth` → latest `5.x` stable (currently on `5.0.0-beta.30`)
- `@auth/prisma-adapter` → latest compatible version. Check the `next-auth` changelog for adapter version compatibility — `@auth/prisma-adapter` v2.x may or may not be compatible with `next-auth` 5.x stable.

**Note:** Minimal effort — these get replaced in Phase 2 (better-auth migration). Just need them working with Next.js 16.

**Risk:** Low-medium. The beta-to-stable jump may have minor API changes, but usage in `src/auth.js` is straightforward.

**Verification:** `npm run build` succeeds, OAuth login flow works.

### Step 5: All Remaining Dependencies

**Dependencies (latest within current major):**
- `@asteasolutions/zod-to-openapi` → latest `^8.x`
- `@vercel/og` → latest
- `axios` → latest `^1.x`
- `dotenv` → latest `^17.x`
- `humanize-duration` → latest `^3.x`
- `react-hook-form` → latest `^7.x`
- `react-icons` → latest `^5.x`
- `swagger-ui-dist` → latest `^5.x`
- `zod` → latest `^4.x` (already on v4, this is a minor/patch bump only)

**Dev dependencies:**
- `@tailwindcss/postcss` → latest `^4.x`
- `chokidar-cli` → latest `^3.x`
- `prettier` → latest `^3.x`
- `prettier-plugin-tailwindcss` → latest `^0.x`
- `tailwindcss` → latest `^4.x`

**Risk:** Low — all within current major versions, minor/patch bumps only.

**Verification:** `npm run build` succeeds, `npm run format` works.

### Step 6: Config Updates & Cleanup

**`next.config.mjs`:**
- Confirm `reactCompiler` moved to top-level (done in Step 1)
- Confirm Sentry config updated for Turbopack (done in Step 2)
- Remove any remaining deprecated options flagged during builds

**`package.json`:**
- Verify `"start": "node .next/standalone/server.js"` works with Next.js 16 standalone output
- Remove `babel-plugin-react-compiler` if no longer needed
- Confirm build script no longer needs `--webpack` flag

**Docker (`Dockerfile.app` and `Dockerfile.migrate`):**
- `Dockerfile.app`: verify `npm run build` works (uses standalone output, copies `.next/standalone`, `.next/static`, `public`)
- `Dockerfile.app`: verify `COPY --from=builder /app/.next/standalone ./` path is still correct
- `Dockerfile.migrate`: verify prisma migrate deploy still works

**Verification:** Full `npm run build`, dev server starts, `npm run format` works, Docker build passes for both Dockerfiles.

## Out of Scope

- better-auth migration (Phase 2 — separate spec)
- Database schema changes
- New features or refactoring
- Test infrastructure
