## 0.5.1 (2025-05-28)

- rework update functions
    - separate `update` directory
    - single update.mjs code split into:
        - update.season.mjs
        - update.status.mjs
        - fetch.season.mjs
        - fetch.status.mjs

## 0.5.0 (2025-05-28)

- status badges in README.md
- /docs works in SSR mode
- generate opengraph-image at /api/og
- moved openapi spec to /public/openapi.json and adjust /Docs page
- moved prisma to production dependencies (as to run migrations from the docker container)
- cleaned up github action workflows
    - deleted manual.docker.yml
    - disabled status.docker.yml
    - created staging.docker.yml
        - added NODE_ENV=staging to build-args
        - added manual dispatch option (replaces manual.docker.yml)
    - edited release.docker.yml, added NODE_ENV=production to build-args
    - adjusted Dockerfile to support build-arg "NODE_ENV"

## TODO

- add instrumentation.js

    - initialize db (migrations, provider, ...)
    - initialize sentry
    - if no data, get current season & snapshot

- make openapi.json generation docker-compatible.
- implement more thoughtful updating for rebroadcast
- store normalized data alongside raw.
- GET /api/h1/attack/[season]
- GET /api/h1/defend/[season]
- GET /api/h1/statistics/[season]
-
