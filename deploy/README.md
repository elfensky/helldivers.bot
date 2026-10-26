# Deploy — helldivers.bot

Staging runs on the Pi swarm (this page, top to bottom); production runs on the Hetzner swarm
(§ Production at the end).

**Status: live, deployed by Git Sync.** `staging/compose.yaml` is the stack on the 3-Pi swarm;
Arcane applies it from the CI-owned branch `deploy/staging`, which CI force-pushes after every
green `develop` build (`bump-staging-tag` in `../.github/workflows/build-staging.yml`). Manual fallback if Arcane is down:
`docker stack deploy -c deploy/staging/compose.yaml helldiversbot`.

## What's live (2026-08-25)

- Ingress is a **Cloudflare Tunnel** (remotely-managed, token in the `cloudflared-helldiversbot`
  Swarm secret). Two `cloudflared` replicas, no placement constraint — both register as
  connectors on the same tunnel and Cloudflare load-balances across them. Public hostname
  `staging.helldivers.bot` → `HTTP` → `app:3000` is configured in the Zero Trust dashboard,
  not in this repo.
- No published ports. The old LAN `:50001` is gone.

- Swarm stack `helldiversbot`: `helldiversbot_app` ×2 (soft-spread across nodes) and
  `helldiversbot_cloudflared` ×2, image pinned to `:sha-<commit>` by CI (multi-arch, pulls
  anonymously from GHCR — the packages are public, no registry auth needed). Load balancing is the
  Swarm service VIP: cloudflared targets `http://app:3000` and Swarm spreads new connections across
  the replicas (per connection, not per request — cloudflared pools keep-alives).
- Connected to the **staging** Postgres on huginn (`10.0.0.40:5433/helldiversbot_staging` on the
  `db-staging` cluster) via the `helldiversbot_database_url` Swarm secret — no longer the dev
  instance on `:5432`. Loaded from a filtered production dump: all 52 migrations plus the `h1_*`
  game tables, with `User`/`Account`/`Session`/`ApiKey` deliberately restored **empty** (the dump
  carried real users' plaintext Google and Discord OAuth tokens).
- Every replica runs the cron thread, but only the lease holder polls (`src/update/lease.mjs`,
  #517): `worker_heartbeat.holder_id` names it, `lease_until` is renewed every poll (60 s TTL), and
  the others answer `200 { role: 'standby' }`. The admin dashboard's "Poller" card shows the host.
  Kill the holder's task and the row moves to another replica within ~1 min, carrying
  `prev_events` / `last_season_observed` with it. Staging sets no `VAPID_*`, so push dedup is not
  observable here — what staging proves is single-holder polling and handover.
- Auth/Umami/Sentry unset on purpose: the app degrades gracefully and OAuth callbacks need a
  real hostname anyway.

## How it is deployed — Arcane Git Sync

`staging/compose.yaml` is the single writer. Arcane on huginn (`arcane.lav.ren`, swarm
environment) polls this repo and applies that file, which makes the compose **read-only in the
Arcane UI** — rollback is a git-side re-pin (below), not a console edit. See the vault:
`knowledge/homelab/truenas-apps-to-arcane.md` § "One writer per stack".

Create it under **Swarm → Stacks**, NOT under Projects. Projects run plain `docker compose` on a
single node, which rejects `external:` secrets outright (`unsupported external secret …`, from
docker/compose `pkg/compose/create.go`). Swarm → Stacks runs `docker stack deploy` and resolves
external secrets correctly — verified.

Stack settings: name `helldiversbot`, repo `https://github.com/elfensky/helldivers.bot`, branch
`deploy/staging`, compose path `deploy/staging/compose.yaml`, environment = the swarm (all three nodes are
managers, so any of them shows the same cluster).

The stack name is the Swarm namespace, so it must stay `helldiversbot` — changing it deploys a
second copy alongside the first rather than renaming anything.

The repo is **public**, so Git Sync needs no token — and nothing secret may enter the compose file.

**Git Sync redeploys on commit change, not on image change.** A rebuilt floating `:staging` tag
produces no commit, so Arcane would never see it. That is why CI (`bump-staging-tag` in
`build-staging.yml`) rewrites the `image:` line to the immutable `:sha-<commit>` tag in the tested
commit's compose and force-pushes that as `deploy/staging` after every green build — the commit
is the deploy trigger. `develop` never takes a CI push, so it can stay PR-only; `develop`'s own
`image:` line is therefore stale and says nothing about what runs. Rollback: re-run the **Bump
Staging Tag** job of the earlier `Build: Staging` run that deployed the good version
(`gh run rerun <run-id> --job <job-id>`) — it pins that run's tested commit again. Do not `docker service update --force` the stack by hand; that is
the second writer this setup exists to remove.

## Swarm secrets (external — create once, on a manager, out of band)

```sh
printf '%s' "$POSTGRES_URL"     | docker secret create helldiversbot_database_url -
printf '%s' "$UPDATE_KEY"       | docker secret create helldiversbot_update_key -
printf '%s' "$CF_TUNNEL_TOKEN"  | docker secret create helldiversbot_cloudflared -
```

Names follow `<app>_<secret>`. Swarm secrets are cluster-global and flat, and an
**external** secret is not prefixed by its stack — so the app prefix has to live in the name or
the next stack on this cluster collides with it.

`printf` not `echo` — a trailing newline can invalidate a token or a connection string.

The app reads both as files via the `*_FILE` convention
(`../src/shared/utils/hydrateFileSecrets.mjs`); the stack sets `POSTGRES_URL_FILE` /
`UPDATE_KEY_FILE`.

## Known gaps

1. **Migrations run on app start, so a broken migration stalls the rollout.** Each new task
   applies pending migrations, and the seed when its data changed, under an advisory lock
   (`../src/update/migrateOnStart.mjs`) before it serves. A failure keeps the NEW task in Starting
   while the old tasks serve. It logs `[migrate] failed: …`, sends a GlitchTip event with stage
   `migrate-on-start`, and retries after 30 s, 60 s, 2 min, then every 5 min. Triage with
   `docker service ps <stack>_app` (tasks stuck in Starting) and
   `docker service logs <stack>_app | grep '\[migrate\]'`.
2. **No self-hosted runner** in the LAN (elfensky/helldivers.bot#474). With Git Sync as the
   writer a runner is no longer needed to *deploy*, and the app migrates itself. A runner is
   needed only to take the maintenance banner up/down around a deploy — the shape in
   the vault's `50-ci-cd`.
3. **Kuma maintenance banner** (`../.github/scripts/kuma-maintenance.mjs`) unverified —
   Socket.IO event shapes vary by version. Unused until a runner exists.
4. **A network partition can briefly yield two holders.** A node cut off from the managers keeps
   its task running; its lease expires and another replica claims it, and until the partitioned
   node reconnects both poll. Bounded by the partition length; power loss (this cluster's actual
   failure mode) does not do this — the task is simply dead. Acceptable for staging; a fencing
   token on writes would close it if it ever matters.

## CI flow (live)

```
merge to develop
  → Check: CI green
  → Build: Staging
       build :staging + :sha-<commit> app image (multi-arch)
       bump-staging-tag: pin :sha-<commit> in deploy/staging/compose.yaml, force-push deploy/staging
  → Arcane Git Sync (polls deploy/staging every 5 min) sees the commit → redeploys the stack
       start-first + image healthcheck + rollback on failure
       new tasks apply pending migrations and the seed before they serve
```

## Production

**Status: ready, not deployed yet.** `production/compose.yaml` is the production stack. Arcane
applies it from the CI-owned branch `deploy/production` once its secrets and Git Sync row exist.
The Git Sync row for the production stack is created only after a pin of the filled compose exists.

- **Stack** `helldiversbot` (services `app` ×2, `cloudflared` ×2) on the Arcane environment
  **production01**, every task on `node.labels.role == apps`. Git Sync: Swarm → Stacks, repo
  `https://github.com/elfensky/helldivers.bot`, branch `deploy/production`, compose path
  `deploy/production/compose.yaml`, project name `helldiversbot`.
- **Ingress** is the tunnel `helldivers.bot (production)`. Its public hostnames
  (`helldivers.bot`, `www.helldivers.bot` → `http://app:3000`) live in the Zero Trust dashboard.
  No published ports.
- **Database** `helldiversbot_prod` on the private network, through the `helldiversbot_database_url`
  secret.
- **Public values** (the VAPID public key and subject, Umami, the OAuth client ids, the server-side
  Sentry DSN) are plain `environment:` in the compose, filled from the password manager.
  `SENTRY_DSN` is plain, not a secret:
  `src/instrumentation.js` reads it before the `*_FILE` values load.
- **Only runtime variables** belong in the compose. The build-time values (`NEXT_PUBLIC_*`, the
  Sentry source-map upload settings) are build args and build secrets of `build-release.yml`.

### Swarm secrets (external, on production01)

| Secret                                  | Read by the app as                    |
| --------------------------------------- | ------------------------------------- |
| `helldiversbot_database_url`            | `POSTGRES_URL_FILE`                   |
| `helldiversbot_update_key`              | `UPDATE_KEY_FILE`                     |
| `helldiversbot_vapid_private_key`       | `VAPID_PRIVATE_KEY_FILE`              |
| `helldiversbot_better_auth_secret`      | `BETTER_AUTH_SECRET_FILE`             |
| `helldiversbot_auth_discord_secret`     | `AUTH_DISCORD_SECRET_FILE`            |
| `helldiversbot_auth_github_secret`      | `AUTH_GITHUB_SECRET_FILE`             |
| `helldiversbot_auth_google_secret`      | `AUTH_GOOGLE_SECRET_FILE`             |
| `helldiversbot_glitchtip_heartbeat_url` | `GLITCHTIP_HEARTBEAT_URL_FILE`        |
| `helldiversbot_cloudflared`             | `cloudflared`, as `TUNNEL_TOKEN_FILE` |

Each is created once, out of band, from the password manager, with the trailing newline stripped
and the value never printed. The names follow `<app>_<secret>`, as on staging.

### The pin

`pin-production` in `../.github/workflows/build-release.yml` writes the release tag into the
`image:` line and force-pushes the result as `deploy/production`. Git Sync redeploys on that
commit. `develop` and `main` carry `:production-unpinned` and say nothing about what runs.

- **A tag push** (`vX.Y.Z`, § Release process in `../AGENTS.md`) builds both images, then pins the
  tag.
- **An existing release** is pinned without a rebuild:
  `gh workflow run build-release.yml --ref <branch> -f tag=vX.Y.Z`. The job pins the tag into the
  compose of `<branch>`, after it checks that the input is `vX.Y.Z` and that
  `helldiversbot:vX.Y.Z` and `helldiversbot-migrate:vX.Y.Z` exist on GHCR.
- **The first pin** runs with `--ref develop`: `main` has no `deploy/production/compose.yaml` until
  a release carries it.
- **Placeholder guard:** the job refuses to pin a compose that still holds a `<FILL>` value.
- **Rollback:** dispatch the previous tag with `--ref main`, once the release that carries this
  job is on `main`. `--ref develop` would pair the old image with develop's newer compose. Never
  edit the stack in the Arcane UI.

### Migrations

No manual step, on staging or production: every new task applies pending migrations, and the seed
when its data changed, before it serves (`../src/update/migrateOnStart.mjs`, § Known gaps item 1
for triage). The rules that stay:

- Every migration stays backward compatible for one release (expand/contract). Start-first runs the
  old and the new version side by side.
- Rollback is a forward migration. Prisma has no down migrations.

The migrate image stays as the manual and emergency tool, for example a migration run while no app
task is up: `docker run --rm -e POSTGRES_URL ghcr.io/elfensky/helldiversbot-migrate:vX.Y.Z`, with
`POSTGRES_URL` set in the shell, never on the command line.
