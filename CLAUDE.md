# CLAUDE.md

Next.js 16 app that caches the official Helldivers 1 API, stores historic game data, and provides API access + frontend visualizations.

## Working Style

- **KISS.** Simple solutions only. Do not overengineer or add abstractions for hypothetical future needs.
- **Use agents** for codebase exploration and multi-step research tasks.
- **Use git worktrees** for parallel development on separate branches.
- **Vitest unit tests** are configured. Run `npm run test:unit:run` for a single run, `npm run test:unit` for watch mode.
- **Playwright smoke tests** are configured. Run `npm run test:smoke` to verify the app builds and runs correctly.
- **Always verify** after implementing a feature: run `npm run build` and `npm run test:unit:run`.
- **Never start the dev server.** Ask the user to start it separately if needed (e.g., for smoke tests).
- Commands are in `package.json` (`npm run` to list). Env vars are in `.example.env`.

## Conventions

### Error Handling

Use the `tryCatch` wrapper (`src/utils/tryCatch.mjs`). Do NOT use try/catch blocks.

```js
const { data, error } = await tryCatch(someAsyncOperation());
if (error) {
    /* handle */
}
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
- **Prisma 7** with `@prisma/adapter-pg` driver adapter. Client outputs to `src/generated/prisma/`. CLI config in `prisma.config.mjs`.
- **Auth:** NextAuth.js v5 with database sessions (not JWT). Discord + GitHub OAuth.
- **React Compiler** enabled experimentally in `next.config.mjs`.
- **Error tracking:** Sentry SDK configured for self-hosted Bugsink (`tracesSampleRate: 0`, no replays/logs).
- **Node version:** Volta pins node@22 and npm@11.
- **Server actions:** Most utilities use `'use server'` directive.

## Task Tracking

All work is tracked via [GitHub Issues](https://github.com/elfensky/helldivers.bot/issues) and the [helldiversbot project board](https://github.com/users/elfensky/projects/5). Do NOT use `docs/TODO.md` — it is deprecated.

### Organization

- **Milestones** group issues by phase: Phase 0 (Initial Release) through Phase 11, plus Shelved.
- **Labels**: `bug`, `enhancement`, `feature`, `api`, `frontend`, `infrastructure`, `security`, `chore`, `shelved`.
- **Project board** statuses: `Backlog`, `In progress`, `Done`.
- Issue title prefixes: `Phase N:`, `API:`, `Feature:`, `Shelved:`.

### Workflow — Keep Issues & Project Updated

When working on a feature or fix:

1. **Before starting**: Check GitHub Issues for existing tracking. If none exists, create one with the correct milestone, labels, and project board assignment.
2. **When starting work**: Move the issue to `In progress` on the project board (`gh project item-edit`).
3. **When done**: Close the issue with a comment describing what was implemented. The project board auto-moves closed issues to `Done`.
4. **New issues**: Always assign a milestone, at least one label, and add to the helldiversbot project (`gh project item-add 5 --owner elfensky --url <issue-url>`).

## Specs & Plans

For every phase or feature, create both files in `docs/superpowers/`:

- **Spec** (`specs/{date}-phase-{N}-{name}.md`) — what and why: requirements, design decisions, schema changes, rationale.
- **Plan** (`plans/{date}-phase-{N}-{name}.md`) — how and in what order: step-by-step implementation with specific files to create/modify.

## Reference Docs

| Topic                              | Location                         |
| ---------------------------------- | -------------------------------- |
| Docker, CI/CD, init flow, env vars | `docs/01-infrastructure.md`      |
| Database schema & relationships    | `docs/02-database-schema.md`     |
| Data pipeline & worker lifecycle   | `docs/03-data-flow.md`           |
| API endpoints & authentication     | `docs/04-api-reference.md`       |
| Utilities & Zod validators         | `docs/05-utilities-reference.md` |
| Testing infrastructure             | `docs/06-testing.md`             |
