# Staging deploy — helldivers.bot on the Pi swarm

**Status: live, deployed by Git Sync.** `staging/compose.yaml` is the stack on the 3-Pi swarm;
Arcane applies it on every commit to `develop`, and CI writes that commit (`bump-staging-tag` in
`../.github/workflows/build-staging.yml`). Manual fallback if Arcane is down:
`docker stack deploy -c deploy/staging/compose.yaml helldiversbot`.

## What's live (2026-08-25)

- Ingress is a **Cloudflare Tunnel** (remotely-managed, token in the `cloudflared-helldiversbot`
  Swarm secret). Two `cloudflared` replicas, no placement constraint — both register as
  connectors on the same tunnel and Cloudflare load-balances across them. Public hostname
  `staging.helldivers.bot` → `HTTP` → `app:3000` is configured in the Zero Trust dashboard,
  not in this repo.
- No published ports. The old LAN `:50001` is gone.

- Swarm stack `helldiversbot`: `helldiversbot_app` ×3 (soft-spread across nodes) and
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
Arcane UI** — rollback is `git revert`, not a console edit. See the vault:
`knowledge/homelab/truenas-apps-to-arcane.md` § "One writer per stack".

Create it under **Swarm → Stacks**, NOT under Projects. Projects run plain `docker compose` on a
single node, which rejects `external:` secrets outright (`unsupported external secret …`, from
docker/compose `pkg/compose/create.go`). Swarm → Stacks runs `docker stack deploy` and resolves
external secrets correctly — verified.

Stack settings: name `helldiversbot`, repo `https://github.com/elfensky/helldivers.bot`, branch
`develop`, compose path `deploy/staging/compose.yaml`, environment = the swarm (all three nodes are
managers, so any of them shows the same cluster).

The stack name is the Swarm namespace, so it must stay `helldiversbot` — changing it deploys a
second copy alongside the first rather than renaming anything.

The repo is **public**, so Git Sync needs no token — and nothing secret may enter the compose file.

**Git Sync redeploys on commit change, not on image change.** A rebuilt floating `:staging` tag
produces no commit, so Arcane would never see it. That is why CI (`bump-staging-tag` in
`build-staging.yml`) rewrites the `image:` line to the immutable `:sha-<commit>` tag and commits
it to `develop` after every green build — the commit is the deploy trigger, and `git revert` of
that commit is the rollback. Do not `docker service update --force` the stack by hand; that is
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

1. **`helldiversbot-migrate:staging` is amd64-only** (`platforms: linux/amd64` in
   `build-staging.yml`) — `prisma generate` SIGILLs under QEMU arm64 (exit 132), so it is not a
   one-line fix; a native arm64 runner leg would be needed. Until then it cannot run on the Pis:
   run it from an amd64 host, and note that `bump-staging-tag` deliberately skips any merge that
   touches `prisma/` (see § How it is deployed).
2. **No self-hosted runner** in the LAN (elfensky/helldivers.bot#474). With Git Sync as the
   writer a runner is no longer needed to *deploy*; it is needed only to run migrations against
   the LAN database and to take the maintenance banner up/down around a deploy — the shape in
   the vault's `50-ci-cd`. Until it exists, migrations are a manual one-shot.
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
       bump-staging-tag: pin :sha-<commit> in deploy/staging/compose.yaml, commit [skip ci]
         (skipped with a warning when the merge touches prisma/ — migrate by hand first)
  → Arcane Git Sync (polls every 5 min) sees the commit → redeploys the stack
       start-first + image healthcheck + rollback on failure
```
