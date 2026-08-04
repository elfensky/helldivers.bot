#!/usr/bin/env sh
# Run the visual regression tests inside the official Playwright image.
#
# Docker is not optional here: baseline PNGs are platform-specific (font
# rendering and antialiasing differ between macOS and Linux), so comparing
# against a baseline generated anywhere else fails on noise, not on regressions.
# One image, one set of baselines, same result on every machine and in CI.
#
# Any arguments are forwarded to vitest — `--update` rewrites the baselines.
set -e

IMAGE="mcr.microsoft.com/playwright:v1.62.1-noble"

# node_modules lives in a named volume rather than the bind mount: the host's
# macOS binaries (esbuild, rollup, lightningcss) cannot execute on Linux.
#
# The volume is shared by every checkout, so `npm ci` has to re-run whenever the
# lockfile changes — otherwise a dependency bump would be screenshotted against
# the PREVIOUS dependency tree and pass, which is worse than not testing at all.
# The stamp is a copy of the lockfile the current node_modules was built from.
exec docker run --rm \
    -v "$PWD":/work \
    -w /work \
    -v hd1-visual-modules:/work/node_modules \
    "$IMAGE" \
    sh -c '
        STAMP=node_modules/.lockstamp
        if ! cmp -s package-lock.json "$STAMP"; then
            npm ci && cp package-lock.json "$STAMP"
        fi
        exec npx vitest run --config vitest.visual.config.mjs "$@"
    ' -- "$@"
