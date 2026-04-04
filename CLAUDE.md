# CLAUDE.md

Next.js 16 app that caches the official Helldivers 1 API, stores historic game data, and provides API access + frontend visualizations.

## Critical Rules

- **KISS.** Simple solutions only. Do not overengineer or add abstractions for hypothetical future needs.
- **Never commit or push directly to `main` or `develop`** — always branch first, merge via PR.
- **Always verify** after implementing a feature: run `npm run build` and `npm run test:unit`.
- **Assume the dev server is already running on :3000.** Ask the user to (re)start it separately if needed to clear cache or if it crashed.
- Report outcomes faithfully: if tests fail, say so with the relevant output; if you did not run a verification step, say that rather than implying it succeeded. Never claim "all tests pass" when output shows failures, never suppress or simplify failing checks (tests, lints, type errors) to manufacture a green result, and never characterize incomplete or broken work as done.

## File & Function Size

- Prefer files under ~500–800 LOC. Files over 1000 LOC must be split before major changes.
- Functions should stay under ~100 lines. Functions over 200 lines must be refactored before modification.
- Prioritize cohesion (one responsibility per file/module), clear boundaries, and readability over compactness.
- When reading files over 500 lines, use offset and limit parameters to read in chunks.
- When renaming or changing a function/type/variable, search for: direct calls, type references, string literals, re-exports, barrel files, and test mocks. Don't assume a single grep found everything.

## Working Style

- **Use agents** for codebase exploration and multi-step research tasks.
- **Use git worktrees** for parallel development on separate branches.
- **Vitest:** `npm run test:unit` (single run), `npm run test:coverage` (with coverage).
- **Playwright smoke tests:** `npm run test:e2e` to verify app builds and runs.
- Commands are in `package.json` (`npm run` to list). Env vars are in `.example.env`.

### DevTools Verification

Chrome DevTools MCP is available for debugging live pages. Use `evaluate_script` to inspect DOM state and RSC payload data. **Always verify CSS issues via DevTools before guessing** — use `getComputedStyle()` to check actual applied values.

After any frontend/CSS change, verify via DevTools before declaring done:

- `getComputedStyle()` — confirm CSS properties match intent
- `getBoundingClientRect()` — confirm sizing, no unexpected overflow
- For map/SVG: verify SVG rect within container rect on all sides
- For grid/flex: check parent-child sizing chain
- For interactive changes: programmatically trigger state changes and verify DOM updates

## Git Workflow

**Branching model:** Simplified Git Flow — no release branches.

| Branch            | Purpose              | Deploys to            | Protected     |
| ----------------- | -------------------- | --------------------- | ------------- |
| `main`            | Production releases  | Production (via tags) | Yes — PR only |
| `develop`         | Integration/staging  | Staging (auto)        | No            |
| `feature/<desc>`  | New functionality    | —                     | No            |
| `bugfix/<desc>`   | Non-urgent fixes     | —                     | No            |
| `hotfix/<semver>` | Emergency prod fixes | —                     | No            |

**Rules:**

1. **Create feature/bugfix/chore branches from `develop`.** Features merge back via PR. Bugfix and chore branches merge via fast-forward into `develop` (branch → commit → `git merge` into develop → push → delete branch). No PR needed.
2. **Release process:** Update `CHANGELOG.md` (move Unreleased items under new `## X.Y.Z` header) → merge `develop` → `main` via PR → **tag `vX.Y.Z` on the merge commit on `main`** → push tag. The production Docker build only triggers on version tags, so forgetting to tag means no deployment.
3. **Hotfix process:** Cut `hotfix/X.Y.Z` from `main` → fix → update `CHANGELOG.md` → PR to `main` → tag `vX.Y.Z` → merge back to `develop`
4. **Semver tagging:** `v<major>.<minor>.<patch>` on `main` only (always use `v` prefix)

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

Prettier with tailwindcss plugin. No ESLint configured. **Always run `npx prettier --write .` before committing** — not during development.

### Styling

Tailwind-first: use utility classes and theme tokens (`bg-primary`, `border-ghost`, `text-text-muted`, etc.) before reaching for custom CSS. Only create a `.css` file when Tailwind cannot express the style (complex animations, pseudo-element content, multi-selector cascades). If a CSS custom property is used in more than one component, add it to the `@theme` block in `layout.css` so it's available as a utility.

### Design Tokens

All visual properties use CSS custom properties from `src/styles/tokens.css`, integrated into Tailwind v4 `@theme` block in `src/app/layout.css`. See `/brandkit` for visual reference.

- Colors: `--color-primary`, `--color-danger`, `--color-surface-0` through `--color-surface-4`, `--color-faction-*`
- Fonts: `--font-display` (Insignia, titles only), `--font-body` (Inter), `--font-mono` (Space Mono)
- Faction colors: Bugs=#E8822A (orange), Cyborgs=#8B2D2D (dark red), Illuminate=#7EC8E3 (cyan)
- Border radius: 0px everywhere (enforced via Tailwind `@theme`)
- Cards: right-side accent line (4-6px) using CSS Grid

## Architecture — Stack

- **Two-table strategy:** `rebroadcast_*` tables store raw API JSON; `h1_*` tables store normalized historical data. Both are needed.
- **Worker thread** (`public/workers/cron.js`) uses `setTimeout` (not `setInterval`) to prevent overlapping requests.
- **Prisma 7** with `@prisma/adapter-pg` driver adapter. Client outputs to `src/generated/prisma/`. CLI config in `prisma.config.mjs`.
- **Auth:** NextAuth.js v5 with database sessions (not JWT). Discord + GitHub OAuth.
- **React Compiler** enabled experimentally in `next.config.mjs`.
- **Error tracking:** Sentry SDK configured for self-hosted Bugsink (`tracesSampleRate: 0`, no replays/logs).
- **Node version:** mise pins node@24 (ships with npm 11 natively).
- **Server actions:** Most utilities use `'use server'` directive.
- **Shared utilities:** `formatNumber` (`src/utils/formatNumber.mjs`) for compact numbers (12.3M, 1.2K). `formatTimeAgo` (`src/utils/formatTimeAgo.mjs`) for relative timestamps.
- **Map state:** `computeMapState` (`src/utils/computeMapState.mjs`) computes galaxy map sector ownership. Sectors 1-10 from campaign `points`/`points_max`; region 11 (homeworld) from attack events only. **Critical:** live views must only pass active events — completed events are already in the score.
- **On-demand season fetching:** `/archives` page derives SeasonSelector from current season number (not DB query). Missing seasons fetched from official API on first request via `fetchAndSeedSeason()` (`src/db/queries/fetchAndSeedSeason.mjs`).
- **SSE live updates:** Worker polls API → DB write → `pg NOTIFY campaign_update` → SSE manager (`src/shared/utils/sse/sseManager.mjs`) broadcasts full campaign state via `/api/h1/stream` → `useLiveData` hook (`src/shared/hooks/useLiveData.mjs`) replaces React state. Postgres LISTEN/NOTIFY bridges worker thread and Next.js process (Prisma doesn't support LISTEN/NOTIFY — uses dedicated `pg.Client`).
- **Notifications:** `detectChanges()` (`src/shared/utils/game/detectChanges.mjs`) detects event transitions (started/won/lost) on both client (Sonner toasts + Web Notifications) and server (push via `web-push`). Single "Enable notifications" button enables both web and push. Push subscriptions stored in `push_subscription` table.
- **PWA:** Service worker (`public/sw.js`) caches app shell, handles push events. Last SSE payload cached in localStorage for offline fallback.

## Architecture — Frontend Layout

- **Mobile-first layout:** Phase 6 single-column dashboard. Phase 7 added tablet responsive (md: portrait, lg: landscape with map+sidebar). Phase 9 removed snap scroll, added hero section, replaced `WarSummary` with WON/LOST stat cards in StatGrid.
- **Key components:** `BottomNav` (hidden at md:), `HeaderNav` (page links at md:), `FactionTabs`, `StatGrid`, `DashboardClient`, `EventCard`, `TimelineSection`, `ConnectionStatus`, `LiveToasts`, `NotificationToggle`.
- **Dashboard hero section:** At lg:, fills viewport height (`height: calc(100dvh - 80px)`). Sidebar (hero text + regions + stats) left, galaxy map right. Normal scroll to `TimelineSection` below.
- **Map sizing:** Map column sized from viewport height via `minmax(0, calc((100dvh - 80px) * 806.93 / 868.81))`. SVG uses `preserveAspectRatio="xMaxYMid meet"`. Galaxy wrapper uses `w-full h-full`.
- **Grid rules:** Columns must use `minmax(0, 1fr)` not bare `1fr` to prevent overflow. Dashboard grid: `minmax(260px, 1fr) minmax(0, calc(...))` — single definition for all desktop breakpoints.

## Task Tracking

All work tracked via [GitHub Issues](https://github.com/elfensky/helldivers.bot/issues) and [helldiversbot project board](https://github.com/users/elfensky/projects/5).

- **Milestones** group issues by phase (Phase 0–11, plus Shelved). Phases 4, 7, and 11 are closed.
- **Labels**: `bug`, `enhancement`, `feature`, `api`, `frontend`, `infrastructure`, `security`, `chore`, `shelved`.
- **Board statuses**: `Backlog` → `In progress` → `Done`. Issue title prefixes: `Phase N:`, `Shelved:`.
- **Board fields**: Status, Priority (`P0`/`P1`/`P2`), Size (`XS`/`S`/`M`/`L`/`XL`), Estimate (hours), Start/End date (skip weekends).

### Workflow

1. **Before starting**: Check GitHub Issues. If none exists, create one with milestone, labels, and project board assignment (`gh project item-add 5 --owner elfensky --url <issue-url>`).
2. **When starting**: Move issue to `In progress`, set Start date to today.
3. **When done**: Close issue with implementation comment, set End date. Board auto-moves to `Done`.
4. **Timeline maintenance**: Update Start/End dates on downstream items when estimates shift.

## Specs & Plans

For every phase or feature, use the `/superpowers:brainstorming` skill to explore requirements and design, then `/octo:embrace` to execute a full Discovery → Define → Develop → Deliver workflow. These skills generate specs and plans as conversation artifacts — no separate doc files needed.

## Reference Docs

| Topic                              | Location                                                                                                                   |
| ---------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| Docker, CI/CD, init flow, env vars | [Wiki: Infrastructure](https://github.com/elfensky/helldivers.bot/wiki/Infrastructure)                                     |
| Database schema & relationships    | [Wiki: Database-Schema](https://github.com/elfensky/helldivers.bot/wiki/Database-Schema)                                   |
| Data pipeline & worker lifecycle   | [Wiki: Data-Flow](https://github.com/elfensky/helldivers.bot/wiki/Data-Flow)                                               |
| API endpoints & authentication     | [Wiki: API-Reference](https://github.com/elfensky/helldivers.bot/wiki/API-Reference)                                       |
| Utilities & Zod validators         | [Wiki: Utilities-Reference](https://github.com/elfensky/helldivers.bot/wiki/Utilities-Reference)                           |
| Testing infrastructure             | [Wiki: Testing](https://github.com/elfensky/helldivers.bot/wiki/Testing)                                                   |
| Real-time & notifications          | `/docs/notifications` (interactive diagram) + [Wiki: Real-Time](https://github.com/elfensky/helldivers.bot/wiki/Real-Time) |
| Frontend design system & tokens    | `/docs/brandkit` (visual) + `src/app/layout.css`                                                                           |
