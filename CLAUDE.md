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
- **Chrome DevTools MCP** is available for debugging live pages. Use `evaluate_script` to inspect DOM state (e.g., sector CSS classes) and extract RSC payload data. Useful for verifying map state, comparing field values, and debugging visual issues without screenshots.
- Commands are in `package.json` (`npm run` to list). Env vars are in `.example.env`.

## Git Workflow

**Branching model:** Simplified Git Flow — no release branches.

| Branch            | Purpose              | Deploys to            | Protected     |
| ----------------- | -------------------- | --------------------- | ------------- |
| `main`            | Production releases  | Production (via tags) | Yes — PR only |
| `develop`         | Integration/staging  | Staging (auto)        | Yes — PR only |
| `feature/<desc>`  | New functionality    | —                     | No            |
| `bugfix/<desc>`   | Non-urgent fixes     | —                     | No            |
| `hotfix/<semver>` | Emergency prod fixes | —                     | No            |

**Rules:**

1. **Never push directly to `main` or `develop`** — always use pull requests
2. **Create feature/bugfix branches from `develop`**, merge back to `develop` via PR
3. **Release process:** Merge `develop` → `main` via PR → tag `vX.Y.0` on main
4. **Hotfix process:** Cut `hotfix/X.Y.Z` from `main` → fix → PR to `main` → tag `vX.Y.Z` → merge back to `develop`
5. **Semver tagging:** `v<major>.<minor>.<patch>` on `main` only (always use `v` prefix)
6. **After merging hotfix to `main`:** Always merge back to `develop` to prevent drift

**Git Flow automation (git-workflow skill):**

- `/git-workflow:feature <desc>` — create feature branch from `develop`
- `/git-workflow:hotfix <semver>` — create hotfix branch from `main`
- `/git-workflow:finish` — merge current branch to correct target(s), tag, cleanup
- `/git-workflow:flow-status` — show branch status, stale branches, version info

Prefer these commands over manual git operations.

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

Prettier with tailwindcss plugin. No ESLint configured. Run `npm run format` once before committing, not during development.

### Design Tokens

All visual properties use CSS custom properties from `src/styles/tokens.css`:

- Colors: `--color-primary`, `--color-danger`, `--color-surface-0` through `--color-surface-4`, `--color-faction-*`
- Fonts: `--font-display` (Insignia, titles only), `--font-body` (Inter), `--font-mono` (Space Mono)
- Faction colors: Bugs=#E8822A (orange), Cyborgs=#8B2D2D (dark red), Illuminate=#7EC8E3 (cyan)
- Border radius: 0px everywhere (enforced via Tailwind `@theme`)
- Cards: right-side accent line (4-6px) using CSS Grid

## Architecture Notes

- **Two-table strategy:** `rebroadcast_*` tables store raw API JSON; `h1_*` tables store normalized historical data. Both are needed.
- **Worker thread** (`public/workers/cron.js`) uses `setTimeout` (not `setInterval`) to prevent overlapping requests.
- **Prisma 7** with `@prisma/adapter-pg` driver adapter. Client outputs to `src/generated/prisma/`. CLI config in `prisma.config.mjs`.
- **Auth:** NextAuth.js v5 with database sessions (not JWT). Discord + GitHub OAuth.
- **React Compiler** enabled experimentally in `next.config.mjs`.
- **Error tracking:** Sentry SDK configured for self-hosted Bugsink (`tracesSampleRate: 0`, no replays/logs).
- **Node version:** Volta pins node@22 and npm@11.
- **Server actions:** Most utilities use `'use server'` directive.
- **Design tokens:** CSS custom properties in `src/styles/tokens.css`, integrated into Tailwind v4 `@theme` block in `src/app/layout.css`. See `/brandkit` for visual reference.
- **Mobile-first layout:** Phase 6 mobile-first single-column dashboard. Phase 7 added tablet responsive (md: portrait, lg: landscape with map+sidebar). Key components: `BottomNav` (hidden at lg:), `HeaderNav` (page links at lg:), `FactionTabs`, `StatGrid`, `DashboardClient`, `EventCard`.
- **Component patterns:** Data cards use CSS Grid with right-side accent lines. All border-radius is 0px via `@theme` override. **Grid columns must use `minmax(0, 1fr)` not bare `1fr`** to prevent overflow.
- **Viewport minimum:** Below 200px, a "use a larger screen" warning replaces all content. Uses `hidden min-[200px]:contents` wrapper pattern in `layout.jsx`. Header status/GitHub icons are hidden below `sm` (640px) since BottomNav provides navigation.
- **Shared utilities:** `formatNumber` (`src/utils/formatNumber.mjs`) for compact numbers (12.3M, 1.2K). `formatTimeAgo` (`src/utils/formatTimeAgo.mjs`) for relative timestamps ("Updated 3m ago").
- **Map state:** `computeMapState` (`src/utils/computeMapState.mjs`) computes galaxy map sector ownership. Sectors 1-10 come from campaign `points`/`points_max`; region 11 (homeworld) from attack events only. **Critical:** live views must only pass active events — completed events are already in the score.
- **On-demand season fetching:** `/war` page derives SeasonSelector from current season number (not DB query). Missing seasons are fetched from the official API on first request via `fetchAndSeedSeason()` (`src/db/queries/fetchAndSeedSeason.mjs`).

## Task Tracking

All work is tracked via [GitHub Issues](https://github.com/elfensky/helldivers.bot/issues) and the [helldiversbot project board](https://github.com/users/elfensky/projects/5).

### Organization

- **Milestones** group issues by phase: Phase 0 (Initial Release, closed) through Phase 10, plus Shelved. Phase 4 and 11 are closed.
- **Labels**: `bug`, `enhancement`, `feature`, `api`, `frontend`, `infrastructure`, `security`, `chore`, `shelved`.
- **Project board** statuses: `Backlog`, `In progress`, `Done`.
- Issue title prefixes: `Phase N:`, `Shelved:`.

### Project Board Fields

Every issue on the project board has these fields — keep them populated:

- **Status**: `Backlog` → `In progress` → `Done`
- **Priority**: `P0` (current sprint), `P1` (next up), `P2` (later)
- **Size**: `XS` (<2h), `S` (2–4h), `M` (4–8h), `L` (8–16h), `XL` (16+h)
- **Estimate**: Hours (numeric)
- **Start date / End date**: Workday-based timeline (skip weekends)

### Workflow — Keep Issues & Project Updated

When working on a feature or fix:

1. **Before starting**: Check GitHub Issues for existing tracking. If none exists, create one with the correct milestone, labels, and project board assignment.
2. **When starting work**: Move the issue to `In progress` on the project board. Set **Start date** to today.
3. **When done**: Close the issue with a comment describing what was implemented. Set **End date** to today. The project board auto-moves closed issues to `Done`.
4. **New issues**: Always assign a milestone, at least one label, Size, Priority, Estimate, and add to the helldiversbot project (`gh project item-add 5 --owner elfensky --url <issue-url>`).
5. **Timeline maintenance**: When completing work earlier or later than estimated, update Start/End dates on downstream items to keep the timeline realistic. Shift future items forward or back as needed.

## Specs & Plans

For every phase or feature, create both files in `docs/superpowers/`:

- **Spec** (`specs/{date}-phase-{N}-{name}.md`) — what and why: requirements, design decisions, schema changes, rationale.
- **Plan** (`plans/{date}-phase-{N}-{name}.md`) — how and in what order: step-by-step implementation with specific files to create/modify.

## Reference Docs

| Topic                              | Location                                                                                         |
| ---------------------------------- | ------------------------------------------------------------------------------------------------ |
| Docker, CI/CD, init flow, env vars | [Wiki: Infrastructure](https://github.com/elfensky/helldivers.bot/wiki/Infrastructure)           |
| Database schema & relationships    | [Wiki: Database-Schema](https://github.com/elfensky/helldivers.bot/wiki/Database-Schema)         |
| Data pipeline & worker lifecycle   | [Wiki: Data-Flow](https://github.com/elfensky/helldivers.bot/wiki/Data-Flow)                     |
| API endpoints & authentication     | [Wiki: API-Reference](https://github.com/elfensky/helldivers.bot/wiki/API-Reference)             |
| Utilities & Zod validators         | [Wiki: Utilities-Reference](https://github.com/elfensky/helldivers.bot/wiki/Utilities-Reference) |
| Testing infrastructure             | [Wiki: Testing](https://github.com/elfensky/helldivers.bot/wiki/Testing)                         |
| Frontend design system & tokens    | `/brandkit` (visual) + `src/styles/tokens.css`                                                   |
