# Technical Documentation

Deep technical reference for helldivers.bot internals. For conventions and working style, see [`../CLAUDE.md`](../CLAUDE.md).

## Documents

| Document                                               | Description                                                                                                   |
| ------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------- |
| [01-infrastructure.md](01-infrastructure.md)           | Docker build strategy, CI/CD pipelines, initialization flow, Sentry/Bugsink, environment variables            |
| [02-database-schema.md](02-database-schema.md)         | Prisma 7 config, driver adapter, all models, relationships, indexes, and constraints with ERD                 |
| [03-data-flow.md](03-data-flow.md)                     | Update pipeline from official API through validation to database, worker thread lifecycle, two-table strategy |
| [04-api-reference.md](04-api-reference.md)             | Every API endpoint: request format, response shapes, error codes, authentication                              |
| [05-utilities-reference.md](05-utilities-reference.md) | Shared utilities and Zod validation schemas — signatures, behavior, usage patterns                            |
| [06-testing.md](06-testing.md)                         | Vitest + Playwright setup, test conventions, mock factories, API route testing patterns                       |

## Design System (Phase 5)

Visual identity defined by CSS custom properties in `src/styles/tokens.css`, integrated into Tailwind v4 via the `@theme` block in `src/app/layout.css`. Tokens cover colors (primary yellow, danger red, 5-level surface tonal layering, game-canonical faction colors), typography (Insignia for titles, Inter for body, Space Mono for data), spacing scale, and 0px border radius enforcement.

The `/brandkit` page is the living visual reference — palette swatches, type scale, spacing, and component demos all reading from CSS custom properties.

## Frontend Components (Phase 6)

Mobile-first single-column layout. Key components:

| Component         | Path                               | Purpose                                                                            |
| ----------------- | ---------------------------------- | ---------------------------------------------------------------------------------- |
| `BottomNav`       | `src/components/layout/BottomNav/` | Fixed bottom tab bar (Live/History/About)                                          |
| `FactionTabs`     | `src/components/h1/FactionTabs/`   | Client-side faction switcher (Global/Bugs/Cyborgs/Illuminate)                      |
| `StatGrid`        | `src/components/h1/StatGrid/`      | 2×2 data card grid, accepts faction filter                                         |
| `DashboardClient` | `src/components/h1/Dashboard/`     | Client wrapper composing Alerts, Galaxy, EventCards, FactionTabs, StatGrid, Events |
| `EventCard`       | `src/components/h1/Galaxy/`        | Per-faction sector progress card (CAPTURING/DEFENDING/ATTACKING)                   |
| `Galaxy`          | `src/components/h1/Galaxy/`        | Map wrapper with "Updated Xs ago" timestamp and hover tooltip                      |
| `Event`           | `src/components/h1/Event/`         | Timeline data card with right-side accent, status-based tinting                    |
| `Alerts`          | `src/components/h1/Alerts/`        | Full-width stacked alert banners for active events                                 |

Data cards use CSS Grid with a right-side accent line (4-6px). Event cards tint backgrounds by status (green=success, red=fail, yellow border=active). Shared utilities: `formatNumber` (compact numbers) and `formatTimeAgo` (relative timestamps) in `src/utils/`.

## Conventions

- File paths are relative to the repository root unless noted otherwise
- Response examples are abbreviated — see source code for complete shapes
- Mermaid diagrams render on GitHub and in most Markdown viewers
