# CLAUDE.md

<!-- Project-specific one-liner goes here -->

## Critical Rules

- **KISS.** Simple solutions only. Do not overengineer or add abstractions for hypothetical future needs.
- **Never commit or push directly to `main` or `develop`** — always branch first, merge via PR.
- **Always verify** after implementing a feature: run `npm run build` and `npm run test:unit`.
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

1. **Create feature/bugfix branches from `develop`**, merge back to `develop` via PR
2. **Release process:** Merge `develop` → `main` via PR → tag `vX.Y.0` on main
3. **Hotfix process:** Cut `hotfix/X.Y.Z` from `main` → fix → PR to `main` → tag `vX.Y.Z` → merge back to `develop`
4. **Semver tagging:** `v<major>.<minor>.<patch>` on `main` only (always use `v` prefix)

## Conventions

### Validation

All external data validated with Zod schemas before database/storage operations.

### Imports

`@/*` maps to `./src/*` (configured in `jsconfig.json`).

### Formatting

Prettier. Run `npm run format` once before committing, not during development.
