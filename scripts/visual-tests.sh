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
# The guard keeps `npm ci` to the first run, or after a lockfile change.
exec docker run --rm \
    -v "$PWD":/work \
    -w /work \
    -v hd1-visual-modules:/work/node_modules \
    "$IMAGE" \
    sh -c '[ -d node_modules/vitest ] || npm ci; exec npx vitest run --config vitest.visual.config.mjs "$@"' -- "$@"
