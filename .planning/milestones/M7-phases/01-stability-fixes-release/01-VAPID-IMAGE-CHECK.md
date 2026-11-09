# VAPID Public Key — Release Image Check

Verifies whether `NEXT_PUBLIC_VAPID_PUBLIC_KEY` survives into the shipped
client bundle. Per D-15, `NEXT_PUBLIC_*` values are inlined into JavaScript
at `next build` time — a value present in the runtime environment but
absent when `next build` ran is still absent in the shipped bundle, and
plan 01-06's new error state (see `01-06-PLAN.md` Task 1/2) would then fire
for every push-capable production visitor.

## What was checked

1. Whether `Dockerfile.app`'s builder stage declares `NEXT_PUBLIC_VAPID_PUBLIC_KEY`
   as an `ARG`/`ENV` before the `npm run build` step (source inspection).
2. Whether `.github/workflows/build-release.yml` passes it as a Docker
   `build-arg` for the tagged production build.
3. A real `docker build` + `docker run | grep`-equivalent check that a
   canary value survives into `.next/static`'s built JS, even when
   explicitly passed as a build-arg — proving the negative directly rather
   than only by reading the Dockerfile.

## 1. Dockerfile.app source inspection

```bash
grep -n "ARG \|ENV \|NEXT_PUBLIC" Dockerfile.app
```

Output (relevant lines only):

```
47:ARG NEXT_PUBLIC_DEPLOY_ENV
48:ENV NEXT_PUBLIC_DEPLOY_ENV=$NEXT_PUBLIC_DEPLOY_ENV
55:ARG NEXT_PUBLIC_SENTRY_DSN
56:ENV NEXT_PUBLIC_SENTRY_DSN=$NEXT_PUBLIC_SENTRY_DSN
...
82:    if [ -f package-lock.json ]; then POSTGRES_URL=postgresql://dummy UPDATE_KEY=dummy UPDATE_INTERVAL=20 npm run build; \
```

Only `NEXT_PUBLIC_DEPLOY_ENV` and `NEXT_PUBLIC_SENTRY_DSN` are declared as
`ARG`/`ENV` in the `builder` stage (`Dockerfile.app` lines 47-56), and the
`RUN ... npm run build` line (line 82) only exports `POSTGRES_URL`,
`UPDATE_KEY`, `UPDATE_INTERVAL` inline. `NEXT_PUBLIC_VAPID_PUBLIC_KEY` is
never declared as an `ARG` anywhere in the file, so even if a caller passes
`--build-arg NEXT_PUBLIC_VAPID_PUBLIC_KEY=...` to `docker build`, Docker
has no `ARG` to receive it — the value is discarded before it can ever
reach `process.env` inside the `RUN npm run build` step.

## 2. Release workflow build-args

```bash
grep -n "NEXT_PUBLIC\|build-arg" .github/workflows/build-release.yml
```

Output (relevant lines only):

```
70:                  build-args: |
72:                      NEXT_PUBLIC_DEPLOY_ENV=production
73:                      NEXT_PUBLIC_SENTRY_DSN=${{ vars.NEXT_PUBLIC_SENTRY_DSN }}
```

`build-release.yml`'s `build-args` block (lines 70-74) passes exactly two
values: `NEXT_PUBLIC_DEPLOY_ENV` and `NEXT_PUBLIC_SENTRY_DSN`.
`NEXT_PUBLIC_VAPID_PUBLIC_KEY` is not present. The same is true of
`build-staging.yml` (lines 144-148) — neither workflow passes the VAPID
public key as a build arg, so this is not release-vs-staging drift, it is
absent from both.

## 3. Reproducible docker build + grep

A real image was built locally from `Dockerfile.app`, explicitly passing a
canary value as a build-arg to prove the negative directly (not just by
reading the Dockerfile) — if the Dockerfile *did* have an `ARG
NEXT_PUBLIC_VAPID_PUBLIC_KEY` declaration, this canary would appear in the
built bundle; it does not.

```bash
docker build -f Dockerfile.app -t helldiversbot-vapid-check:local \
  --build-arg NEXT_PUBLIC_VAPID_PUBLIC_KEY=THIS_IS_A_CANARY_VAPID_VALUE_XYZ123 .
```

Build completed successfully (`exporting to image ... done`, tagged
`helldiversbot-vapid-check:local`).

The runtime image is Google distroless (`gcr.io/distroless/nodejs24-debian12:nonroot`)
and ships no shell, so the bundle is grepped via `node -e` instead of
`docker run ... | grep`:

```bash
docker run --rm --entrypoint /nodejs/bin/node helldiversbot-vapid-check:local -e "
const fs = require('fs');
const path = require('path');
function walk(dir, out) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(p, out);
    else if (entry.name.endsWith('.js')) out.push(p);
  }
}
const files = [];
walk('/app/.next/static', files);
let found = false;
for (const f of files) {
  const content = fs.readFileSync(f, 'utf8');
  if (content.includes('THIS_IS_A_CANARY_VAPID_VALUE_XYZ123')) {
    console.log('FOUND in', f);
    found = true;
  }
}
console.log('canary present in bundle:', found);
console.log('files scanned:', files.length);
"
```

Output:

```
canary present in bundle: false
files scanned: 135
```

The canary value does not appear in any of the 135 built JS files under
`.next/static`, confirming the source-inspection finding above:
`NEXT_PUBLIC_VAPID_PUBLIC_KEY` cannot reach the shipped bundle through
`Dockerfile.app` as currently written, regardless of what value is passed
at build time or present in the runtime environment.

Per the search variable-name caveat in the plan (`01-06-PLAN.md` Task 3):
the variable name itself does not survive `NEXT_PUBLIC_*` inlining, only
its literal value would — the check above searches for a literal canary
value, not the variable name, for exactly this reason.

## Finding

- `NEXT_PUBLIC_VAPID_PUBLIC_KEY` — **not declared** as `ARG`/`ENV` in
  `Dockerfile.app`'s builder stage.
- `NEXT_PUBLIC_VAPID_PUBLIC_KEY` — **not passed** as a `build-arg` in
  `.github/workflows/build-release.yml` or `.github/workflows/build-staging.yml`.
- A real `docker build` + bundle grep, using an explicit canary build-arg,
  confirms the value never reaches `.next/static`.

Production and staging images built from the current `Dockerfile.app` +
workflows ship without the VAPID public key. Every push-capable visitor
who clicks "Enable notifications" hits `subscribeToPush()`'s missing-key
branch (`01-06` Task 2) and lands in the new `error` state — not a false
"Notifications on".

**This is a release-gate item for plan 01-08**: `Dockerfile.app` needs an
`ARG NEXT_PUBLIC_VAPID_PUBLIC_KEY` / `ENV NEXT_PUBLIC_VAPID_PUBLIC_KEY=$NEXT_PUBLIC_VAPID_PUBLIC_KEY`
pair in the builder stage (mirroring the existing `NEXT_PUBLIC_SENTRY_DSN`
pattern at lines 55-56) and both `build-release.yml` and
`build-staging.yml` need `NEXT_PUBLIC_VAPID_PUBLIC_KEY=${{ vars.NEXT_PUBLIC_VAPID_PUBLIC_KEY }}`
(or an equivalent secret/var reference) added to their `build-args` blocks
before plan 01-06's changes ship to production.

Verdict: ABSENT
