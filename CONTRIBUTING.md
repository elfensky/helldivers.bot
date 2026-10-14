# Contributing to Helldivers Bot

## Branching Strategy

Helldivers Bot uses a **simplified Git Flow** model:

```
main ──────●────────●────────●──── (tagged releases, production)
            \      ↑          ↑
             \   merge    hotfix/*
              \  /
develop ──────●──●──●──●──●──── (staging auto-deploy)
               \   ↑     \
              feature/*  bugfix/*
```

| Branch            | Created from | Merges to          | Lifetime               |
| ----------------- | ------------ | ------------------ | ---------------------- |
| `main`            | —            | —                  | Permanent (production) |
| `develop`         | —            | —                  | Permanent (staging)    |
| `feature/<desc>`  | `develop`    | `develop`          | Days (max 1-2 weeks)   |
| `bugfix/<desc>`   | `develop`    | `develop`          | Days                   |
| `hotfix/<semver>` | `main`       | `main` + `develop` | Hours                  |

### Branch Naming

- `feature/<short-desc>` — e.g., `feature/war-event-tracking`
- `bugfix/<short-desc>` — e.g., `bugfix/dispatch-parser`
- `hotfix/<semver>` — e.g., `hotfix/0.16.1`
- `chore/<short-desc>` — e.g., `chore/upgrade-discord-js`

## Workflow

Every change — feature, bugfix or chore — lands on `develop` by a PR from its own worktree
under `.worktrees/`. The main checkout stays on `develop` and only ever pulls. Commands and the
full rule: [AGENTS.md § Worktrees](AGENTS.md#worktrees--one-lane-always).

1. Create a worktree + branch from `origin/develop`
2. Make changes, commit with conventional commits (`feat:`, `fix:`, `chore:`), bump the version as the last commit
3. Push and open a pull request to `develop`
4. Rebase-merge when CI passes (`gh pr merge --rebase --delete-branch`)
5. Changes deploy to staging

## Release Process

PR `develop` → `main` (merge commit), tag `vX.Y.Z` on the merge commit, push the tag, then merge
`main` back into `develop` by PR. The tag triggers the production Docker build. Full steps:
[AGENTS.md § Git Workflow](AGENTS.md#git-workflow), rule 3.

## Hotfix Process

1. Worktree on `hotfix/<semver>` from `origin/main`
2. Fix, commit with tests
3. PR to `main`, merge
4. Tag and push (triggers production build)
5. Merge `main` back into `develop` by PR

## Versioning

Semantic versioning with `v` prefix (`vMAJOR.MINOR.PATCH`):

- **Major**: Breaking API changes, Discord.js major upgrade
- **Minor**: New commands, features, event handlers
- **Patch**: Bug fixes, dependency updates

**Important:** Always use `v` prefix on tags (e.g., `v0.16.1`, not `0.16.1`).

## Commit Messages

Use conventional commits:

```
feat: add war event tracking
fix: correct dispatch message parsing
chore: upgrade discord.js to v15
refactor: extract event handler base class
```

## CI/CD

| Event                       | Action                                         |
| --------------------------- | ---------------------------------------------- |
| Push to `main` or `develop` | Build + deploy staging Docker image            |
| Tag `v*.*.*`                | Build production Docker images (app + migrate) |
