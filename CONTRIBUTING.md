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

## Git Flow Commands (Claude Code)

```bash
/git-workflow:feature war-event-tracking  # Create feature branch from develop
/git-workflow:hotfix 0.16.1               # Create hotfix branch from main
/git-workflow:finish                       # Merge current branch, tag, cleanup
/git-workflow:flow-status                  # Show branch status and version info
```

## Workflow

1. Create a branch from `develop`
2. Make changes, commit with conventional commits (`feat:`, `fix:`, `chore:`)
3. Push and open a pull request to `develop`
4. Merge when CI passes
5. Changes deploy to staging

## Release Process

Releases are automated via [release-please](https://github.com/googleapis/release-please):

1. Merge PRs to `main` using conventional commits (`feat:`, `fix:`, etc.)
2. release-please automatically creates/updates a Release PR with version bump + changelog
3. Merge the Release PR when ready to ship
4. GitHub Actions automatically: creates git tag, GitHub Release, and builds Docker images

## Hotfix Process

1. Cut `hotfix/<semver>` from `main`
2. Fix, commit with tests
3. PR to `main`, merge
4. Tag and push (triggers production build)
5. Merge `main` back to `develop`

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

| Event                       | Action                                                    |
| --------------------------- | --------------------------------------------------------- |
| Push to `main` or `develop` | Build + deploy staging Docker image                       |
| Push to `main`              | release-please creates/updates Release PR                 |
| Merge Release PR            | Creates git tag + GitHub Release                          |
| Tag `v*.*.*`                | Build production Docker images (app + migrate)            |
