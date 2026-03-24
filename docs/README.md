# Technical Documentation

Deep technical reference for helldivers.bot internals. For conventions and working style, see [`../CLAUDE.md`](../CLAUDE.md).

## Documents

| Document | Description |
|----------|-------------|
| [data-flow.md](data-flow.md) | Update pipeline from official API through validation to database, worker thread lifecycle, two-table strategy |
| [database-schema.md](database-schema.md) | All Prisma models, relationships, indexes, and constraints with entity relationship diagram |
| [api-reference.md](api-reference.md) | Every API endpoint: request format, response shapes, error codes, authentication |
| [utilities-reference.md](utilities-reference.md) | Shared utilities and Zod validation schemas — signatures, behavior, usage patterns |
| [infrastructure.md](infrastructure.md) | Docker build strategy, CI/CD pipelines, initialization flow, Sentry/Bugsink, environment variables |

## Conventions

- File paths are relative to the repository root unless noted otherwise
- Response examples are abbreviated — see source code for complete shapes
- Mermaid diagrams render on GitHub and in most Markdown viewers
