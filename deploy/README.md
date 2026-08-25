# Staging deploy — helldivers.bot on the Pi swarm

**Status: deployed manually, CI path still unwired.** `staging/compose.yaml` is live on the
3-Pi swarm (Arcane Git Sync (manual fallback: `docker stack deploy -c deploy/staging/compose.yaml helldivers`)). The
`deploy-staging` job in `../.github/workflows/build-staging.yml` has still never run.

## What's live (2026-08-25)

- Ingress is a **Cloudflare Tunnel** (remotely-managed, token in the `cloudflared-helldiversbot`
  Swarm secret). Two `cloudflared` replicas, no placement constraint — both register as
  connectors on the same tunnel and Cloudflare load-balances across them. Public hostname
  `staging.helldivers.bot` → `HTTP` → `app:3000` is configured in the Zero Trust dashboard,
  not in this repo.
- No published ports. The old LAN `:50001` is gone.

- Swarm stack `helldiversbot`, services `helldiversbot_app` / `helldiversbot_cloudflared`, 1 replica, `:staging` image (multi-arch, pulls
  anonymously from GHCR — the packages are public, no registry auth needed).
- Connected to the **dev** Postgres on huginn (`10.0.0.40:5432/helldiversbot`) via the
  `staging_postgres_url` Swarm secret. Schema was already current (52/52 migrations).
- `worker: true` — the poller runs and writes `worker_heartbeat` in that DB.
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

## Swarm secrets (external — create once, on a manager, out of band)

```sh
printf '%s' "$POSTGRES_URL"     | docker secret create helldiversbot_postgres_url -
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
   `build-staging.yml`), so it cannot run on the arm64 Pis. Either make that build multi-arch
   like the app image, or keep running migrations from an amd64 host. Blocking for any
   automated deploy that has to migrate.
2. **Own staging database.** It currently points at the *dev* DB, which means laptop and
   swarm share one database and one worker table. Give staging its own role + database on
   huginn per the vault handbook before this counts as a real staging tier.
3. **Floating image tag vs Git Sync.** The compose pins `:staging`, a moving tag — so a new
   build produces no commit, and Arcane (which redeploys on commit change) will not pick it up.
   Per `50-ci-cd`, CI should rewrite the tag in this file and commit; until it does, a new
   `:staging` image needs a manual `docker service update --force helldivers_app`.
4. **No self-hosted runner** on a Pi manager, so `deploy-staging` (`runs-on: self-hosted`) has
   nowhere to run. It stays dormant until repo variable `STAGING_DEPLOY_ENABLED=true`.
5. **Kuma maintenance banner** (`../.github/scripts/kuma-maintenance.mjs`) unverified —
   Socket.IO event shapes vary by version. Leave `vars.KUMA_URL` unset and it skips cleanly.
6. **The app cannot be scaled past 1 replica.** `src/shared/utils/initializeWorker.mjs` spawns a
   cron worker thread on every instance with no advisory lock and no leader election anywhere in
   `src/` — so N replicas means N pollers hitting the API and racing on the same rows. This is a
   correctness limit, not a capacity one. `cloudflared` has no such constraint: connectors are
   stateless and Cloudflare load-balances across them, hence 2 replicas there. Fix is to split the
   poller into its own 1-replica service; then the web app scales freely.

## Intended CI flow (once 1-4 are done)

```
push to develop
  → build :staging images (cloud runners, multi-arch)
  → deploy-staging (self-hosted runner on a Pi manager):
       kuma banner ON (optional)
       docker run --rm migrate:staging        # migrations, BEFORE the stack (Swarm ignores depends_on)
       docker stack deploy stack.staging.yml   # start-first + healthcheck + rollback
       wait for helldivers_app = 1/1
       kuma banner OFF (always)
```
