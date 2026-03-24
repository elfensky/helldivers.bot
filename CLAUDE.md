# CLAUDE.md

Next.js 15 app that caches the official Helldivers 1 API, stores historic game data, and provides API access + frontend visualizations.

## Working Style

- **KISS.** Simple solutions only. Do not overengineer or add abstractions for hypothetical future needs.
- **Use agents** for codebase exploration and multi-step research tasks.
- **Use git worktrees** for parallel development on separate branches.
- **No test framework** is configured. Do not attempt to run tests.
- Commands are in `package.json` (`npm run` to list). Env vars are in `.example.env`.

## Conventions

### Error Handling

Use the `tryCatch` wrapper (`src/utils/tryCatch.mjs`). Do NOT use try/catch blocks.

```js
const { data, error } = await tryCatch(someAsyncOperation());
if (error) { /* handle */ }
```

### API Routes

- Use `errorResponse(code, start, error)` and `successResponse(code, start, data)` from `src/utils/responses.mjs`
- Measure execution time with `roundedPerformanceTime(start)` from `src/utils/time.mjs`

### Validation

All external data validated with Zod schemas (`src/validators/`) before database operations.

### Imports

`@/*` maps to `./src/*` (configured in `jsconfig.json`).

### Formatting

Prettier with tailwindcss plugin. No ESLint configured. Run `npm run format` to auto-format.

## Architecture Notes

- **Two-table strategy:** `rebroadcast_*` tables store raw API JSON; `h1_*` tables store normalized historical data. Both are needed.
- **Worker thread** (`public/workers/cron.js`) uses `setTimeout` (not `setInterval`) to prevent overlapping requests.
- **Prisma Client** outputs to `src/generated/prisma/` (non-default path).
- **Auth:** NextAuth.js v5 with database sessions (not JWT). Discord + GitHub OAuth.
- **React Compiler** enabled experimentally in `next.config.mjs`.
- **Error tracking:** Sentry SDK configured for self-hosted Bugsink (`tracesSampleRate: 0`, no replays/logs).
- **Node version:** Volta pins node@22 and npm@11.
- **Server actions:** Most utilities use `'use server'` directive.

## Reference Docs

| Topic | Location |
|-------|----------|
| Data pipeline & worker lifecycle | `docs/data-flow.md` |
| Database schema & relationships | `docs/database-schema.md` |
| API endpoints & authentication | `docs/api-reference.md` |
| Utilities & Zod validators | `docs/utilities-reference.md` |
| Docker, CI/CD, init flow, env vars | `docs/infrastructure.md` |
