---
name: helldivers.bot infrastructure documentation
description: Documents what has been written in docs/infrastructure.md covering Docker, CI/CD, init flow, Sentry/Bugsink, and env vars
type: project
---

docs/infrastructure.md was written covering: two-Dockerfile strategy (migrate + app), docker-compose startup order, staging and production CI/CD workflows in .github/workflows/, the 4-step initialization sequence in src/instrumentation.js, Sentry/Bugsink configuration across all runtimes, and the full environment variable reference.

**Why:** Project owner requested a technical reference for infrastructure/deployment/initialization aimed at both the owner and AI assistants.

**How to apply:** When asked about deployment, Docker, CI/CD, startup behavior, Sentry integration, or environment variables for this project, this file is the authoritative reference. It documents a notable edge case: NODE_ENV=staging at runtime causes initializeOpenApiSpec() to return false and crash the app — production containers should use NODE_ENV=production at runtime regardless of the build arg.
