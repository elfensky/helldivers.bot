# Task Completion Checklist - helldivers.bot

## After Making Changes

### 1. Code Quality
- [ ] Run `npm run format` to ensure consistent formatting
- [ ] Verify no ESLint errors (if applicable)
- [ ] Check that imports use `@/` alias for src paths

### 2. Type/Validation
- [ ] If adding external data handling, create/update Zod schema in `src/validators/`
- [ ] Use `tryCatch` wrapper for async operations (not try/catch)

### 3. Error Tracking (Sentry/Bugsink)
- [ ] Errors are automatically captured via Sentry SDK
- [ ] For manual error capture, use `Sentry.captureException(error)`
- [ ] Global error boundary at `src/app/global-error.jsx` handles React render errors

### 4. Database Changes
- [ ] If schema changed: `npx prisma migrate dev --name <descriptive_name>`
- [ ] Verify Prisma Client regenerated: `npx prisma generate`
- [ ] Test database operations

### 5. Testing
- [ ] Run `npm run build` to verify production build succeeds
- [ ] Test locally with `npm run dev`
- [ ] If Docker-related: test with `docker compose up`

### 6. Documentation
- [ ] Update CLAUDE.md if architecture or commands changed
- [ ] Update README.md if user-facing features changed

## Before Committing

- [ ] Review all changed files
- [ ] Ensure no secrets or `.env` values committed
- [ ] Verify `.gitignore` is respected
- [ ] Check that build passes

## Deployment Notes

- Every commit builds `:staging` image via GitHub Actions
- Tagged commits build `:production` + create GitHub Release
- Database must exist before running Docker container
