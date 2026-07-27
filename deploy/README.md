# Staging deploy — helldivers.bot on the Pi swarm

**Status: DRAFT / UNTESTED.** These files are scaffolding written ahead of the
cluster existing. None of it has run. The first real `develop` push after the
swarm + self-hosted runner are up is what validates it.

## What's here

- `stack.staging.yml` — the Swarm deploy manifest (app + cloudflared, secrets, start-first rollout).
- `../.github/scripts/kuma-maintenance.mjs` — flips the Uptime Kuma "upgrading" banner on/off.
- The `deploy-staging` job in `../.github/workflows/staging.docker.yml` — runs on the
  self-hosted runner: banner on → migrate one-shot → `docker stack deploy` → wait healthy → banner off.

## Flow

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

## TODO before it can run (blocking)

1. **Self-hosted runner** installed on a Pi swarm **manager** (Settings → Actions → Runners).
   The job uses `runs-on: self-hosted`; the runner needs Docker access on the manager.
2. **Swarm secrets** created on the cluster (external — must exist before deploy):
    ```sh
    printf '%s' "$POSTGRES_URL"     | docker secret create staging_postgres_url -
    printf '%s' "$UPDATE_KEY"       | docker secret create staging_update_key -
    printf '%s' "$CF_TUNNEL_TOKEN"  | docker secret create staging_cf_tunnel_token -
    ```
3. ~~App secrets-as-files wiring.~~ **DONE** — the app supports the `*_FILE`
   convention (`src/shared/utils/hydrateFileSecrets.mjs`): the stack sets
   `POSTGRES_URL_FILE` / `UPDATE_KEY_FILE` and the env loader populates the real
   vars from the mounted secret files before Prisma reads them.
4. **Cloudflare Tunnel.** Create the tunnel, put its token/creds in the
   `staging_cf_tunnel_token` secret, finalize the `cloudflared` service (token via the
   entrypoint shim, or creds-file + a `config.yml` with the ingress rules), point
   `staging.helldivers.bot` at it, and pin the `cloudflare/cloudflared` image tag.
5. **GitHub Actions secrets/vars:**
    - `secrets.STAGING_POSTGRES_URL` — for the migrate one-shot (the documented env exception).
    - Optional Kuma: `vars.KUMA_URL`, `secrets.KUMA_USERNAME`, `secrets.KUMA_PASSWORD`,
      `vars.KUMA_STAGING_MONITOR_IDS`. Leave `KUMA_URL` unset and the banner steps skip cleanly.
6. **Flip the enable flag — do this LAST.** Set repo variable `STAGING_DEPLOY_ENABLED=true`.
   The `deploy-staging` job is **dormant** until then (it skips cleanly instead of hanging
   "pending" for a runner that isn't there), so it's safe to have on `develop` before the
   swarm exists. Flip it once items 1–5 are done.

## TODO to verify (non-blocking)

- `kuma-maintenance.mjs` drives Kuma's Socket.IO API, whose event shapes vary by version —
  verify `addMaintenance` / `addMonitorMaintenance` / `deleteMaintenance` against your Kuma.
- Confirm the app image ships `/bin/sh` if you use the cloudflared/app entrypoint-shim option.
