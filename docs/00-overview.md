# Technical Documentation

Deep technical reference for helldivers.bot internals. For conventions and working style, see [`../CLAUDE.md`](../CLAUDE.md).

## Documents

| Document                                               | Description                                                                                                   |
| ------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------- |
| [01-infrastructure.md](01-infrastructure.md)           | Docker build strategy, CI/CD pipelines, initialization flow, Sentry/Bugsink, environment variables            |
| [02-database-schema.md](02-database-schema.md)         | Prisma 7 config, driver adapter, all models, relationships, indexes, and constraints with ERD                 |
| [03-data-flow.md](03-data-flow.md)                     | Update pipeline from official API through validation to database, worker thread lifecycle, two-table strategy |
| [04-api-reference.md](04-api-reference.md)             | Every API endpoint: request format, response shapes, error codes, authentication                              |
| [05-utilities-reference.md](05-utilities-reference.md) | Shared utilities and Zod validation schemas — signatures, behavior, usage patterns                            |
| [06-testing.md](06-testing.md)                         | Vitest + Playwright setup, test conventions, mock factories, API route testing patterns                       |

## Conventions

- File paths are relative to the repository root unless noted otherwise
- Response examples are abbreviated — see source code for complete shapes
- Mermaid diagrams render on GitHub and in most Markdown viewers
