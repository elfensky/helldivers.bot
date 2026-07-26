#!/usr/bin/env bash
#
# Assemble the `output: 'standalone'` build produced by `npm run build`, boot it,
# and block until /api/healthcheck answers 200.
#
# WHY THIS EXISTS
#
# next.config.mjs sets `output: 'standalone'`, so `next start` does not work —
# the runnable artifact is `.next/standalone/**/server.js`, and `next build`
# deliberately omits `.next/static` and `public/` from that tree (they are
# expected to be served by a CDN). Dockerfile.app copies both in at image build
# time (lines 125-127); this script is the non-Docker equivalent, so the CI
# smoke gate can boot the very build it just produced instead of throwing it away.
#
# Kept as a script rather than inline workflow YAML so a developer can reproduce
# the CI gate verbatim:
#
#   npm run build
#   PORT=3200 scripts/start-standalone.sh
#   TEST_SERVER_URL=http://127.0.0.1:3200 npm run test:smoke
#   kill "$(cat .next/standalone-server.pid)"
#
# The server is left running in the background; its PID is written to
# .next/standalone-server.pid and its output to .next/standalone-server.log.

set -euo pipefail

PORT="${PORT:-3000}"
# Next's standalone server binds to $HOSTNAME, but that name is already taken:
# most shells and every Docker container export it as the machine name, which
# would make the bind address (and this script's healthcheck URL) depend on the
# host it runs on. Take the address from BIND_HOST instead and set HOSTNAME for
# the server process only.
BIND_HOST="${BIND_HOST:-127.0.0.1}"
# Healthcheck budget. A cold standalone boot is ~1-2s; 60s is slack for a loaded
# CI runner without letting a genuinely dead server hang the job.
BOOT_TIMEOUT_SECONDS="${BOOT_TIMEOUT_SECONDS:-60}"

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$repo_root"

if [ ! -d .next/standalone ]; then
    echo "error: .next/standalone does not exist — run 'npm run build' first." >&2
    exit 1
fi

# Locate server.js rather than hardcoding `.next/standalone/server.js`. Next.js
# nests the standalone tree under the path from its inferred workspace root, so
# the file sits at the top level for a normal checkout but one directory deeper
# when the build runs inside a git worktree (an extra lockfile moves the root).
# Finding it keeps this script identical in both, which is what lets the CI gate
# be rehearsed locally. node_modules is excluded — it contains unrelated
# server.js files (e.g. next/dist/experimental/testmode/server.js).
server_js="$(find .next/standalone -maxdepth 4 -name server.js -not -path '*/node_modules/*' | head -n 1)"
if [ -z "$server_js" ]; then
    echo "error: no server.js found under .next/standalone — is output:'standalone' still set?" >&2
    exit 1
fi
server_dir="$(dirname "$server_js")"
echo "standalone server: $server_js"

# The two trees next build leaves out. Mirrors Dockerfile.app lines 126-127.
mkdir -p "$server_dir/.next"
cp -R .next/static "$server_dir/.next/static"
cp -R public "$server_dir/public"

log_file="$repo_root/.next/standalone-server.log"
pid_file="$repo_root/.next/standalone-server.pid"

PORT="$PORT" HOSTNAME="$BIND_HOST" node "$server_js" >"$log_file" 2>&1 &
server_pid=$!
echo "$server_pid" >"$pid_file"
echo "started pid $server_pid on $BIND_HOST:$PORT (log: $log_file)"

url="http://${BIND_HOST}:${PORT}/api/healthcheck"
for _ in $(seq 1 "$BOOT_TIMEOUT_SECONDS"); do
    if ! kill -0 "$server_pid" 2>/dev/null; then
        echo "error: the standalone server exited before becoming healthy. Log:" >&2
        cat "$log_file" >&2
        exit 1
    fi
    # -f (fail on non-2xx), silent: connection refused is the expected answer
    # while the server is still coming up, and this loop reports the real
    # failure itself if the budget runs out.
    if curl -fs -o /dev/null "$url"; then
        echo "healthy: $url returned 200"
        exit 0
    fi
    sleep 1
done

echo "error: $url did not return 200 within ${BOOT_TIMEOUT_SECONDS}s. Log:" >&2
cat "$log_file" >&2
kill "$server_pid" 2>/dev/null || true
exit 1
