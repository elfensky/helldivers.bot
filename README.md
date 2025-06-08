# helldivers.bot

## Code

[![Build](https://github.com/elfensky/helldivers1api/actions/workflows/staging.docker.yml/badge.svg)](https://github.com/elfensky/helldivers1api/actions/workflows/staging.docker.yml)
[![Time](https://wakapi.lavrenov.io/api/badge/elfensky/interval:any/project:helldivers1api)](https://wakapi.lavrenov.io/leaderboard)

## Status

![Website](https://img.shields.io/website?url=https%3A%2F%2Fstaging.helldivers.bot&up_message=online&down_message=offline&label=staging)
![Website](https://img.shields.io/website?url=https%3A%2F%2Fhelldivers.bot&up_message=online&down_message=offline&label=production)

This is an application that consumes the official Helldivers 1 API, caches and rebroadcasts it as to avoid high load on official servers.
It also stores historic data that the official API discards, and offers account management and api keys for 3rd parties to access the API to build their own apps.
The frontend also shows various data visualizations and notifies visitors of in-game events.

It uses:

- [Next.js](https://nextjs.org), bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).
    - App Router for the frontend
    - API Routes for the backend
- [ESLint](https://eslint.org) for linting.
    <!-- - [Vitest](https://vitest.dev) for testing -->
- [Prisma](https://prisma.io) for database access.
- [Sentry](https://sentry.io) for analytics
    <!-- -   [Docker](https://www.docker.com) for deployment -->

## Running locally

1. provide a `.env` file with the following content:

```
DATABASE_URL="postgresql://user:password@host:port/helldiversbot?schema=public"
```

## Docker

When using the docker container, the database you are connecting to needs to already exist. It will **not** create it for you.

- docker login ghcr.io
    - username: your-github-username
    - password: classic-key-with-correct-permissions

#### Build locally

- Use `docker build -t ghcr.io/elfensky/helldivers1api:staging --build-arg NODE_ENV=staging .` to build the image locally for local hardware
- Use `docker buildx build --platform linux/amd64 -t ghcr.io/elfensky/helldivers1api:staging --build-arg NODE_ENV=staging .` to build the image for standard x32_64 hardware
- Use `docker compose up` to run the container locally.

#### Deploy to ghcr.io

Use `docker push ghcr.io/elfensky/helldivers1api:staging` to push the image to ghcr.io.

## Prisma

`npx prisma migrate reset`
reset all data in db

`npx prisma generate`
reads your Prisma schema and generates the Prisma Client.

`npx prisma migrate dev`
`npx prisma migrate dev --name init`
Purpose: This command generates and applies a new migration based on your Prisma schema changes. It creates migration files that keep a history of changes.
Use Case: Use this when you want to maintain a record of database changes, which is essential for production environments or when working in teams. It allows for version control of your database schema.
Benefits: This command also includes checks for applying migrations in a controlled manner, ensuring data integrity.

`npx prisma db push`
Purpose: This command is used to push your current Prisma schema to the database directly. It applies any changes you've made to your schema without creating migration files.
Use Case: It’s particularly useful during the development phase when you want to quickly sync your database schema with your Prisma schema without worrying about migration history.
Caution: It can overwrite data if your schema changes affect existing tables or columns, so it’s best for early-stage development or prototyping.

## How it works.

The application is made from 2 large sections:

- the api that serves and updates the data
- the frontend that consumes the api and visualized it, alongside user-facing features.

### Initialization

On startup, it runs instrumentation.js (once) which will:

1. check if openapi spec exists (or generate it in dev mode)
2. check if database connection exists and is valid
3. initialize the database:

    1. run migrations.
    2. fetch remote currentStatus + currentSeason
    3. save raw json in the rebroadcast_tables.
    4. save normalized data in the h1_tables.
        - option1: generate empty (last_updated = null) seasons in h1_season. This is needed because the official API sometimes includes events from past seasons. This happens when we completely loose, and no attack events were recorded for that campaign. In that case, the api will return the last recorded attack events (instead of leaving them as null). When this happens, that old season needs to exist in the database, so we can save the related events.
        - option2: we pass along the current season, and if it doesn't match with the event, we ignore and do not save it. Might be a simpler better solution actually.

4. start a worker thread that will continiously update the database from the official Helldivers API. It simply queries the /api/h1/update endpoint every `UPDATE_INTERVAL` seconds using the `UPDATE_KEY` token.

### API

Using next js api routes, this contains various endpoints that provide helldiver data in various formats.

- GET /api/h1/update
    - Trigger current campaign status and snapshot updates
    - Requires a valid `key` query parameter matching the server's `UPDATE_KEY` environment variable.
- GET /api/h1/rebroadcast
    - Mirrors the official API behavior.
    - Perform a campaign status or snapshot action
    - Request body:
        - action: string
            - get_campaign_status
            - get_snapshot
        - season: integer
            - Required if action is get_snapshot.
- GET /api/h1/campaign

    - Custom endpoint with optional `season` query parameter.
    - Returns combined status and snapshot information of a specific season in one query.

- GET /api/h1/stats (not implemented)
    - Custom endpoint that returns global stats for the entire game.
    - Calculated once per day by the worker.
    - Returns:
        - total wins
        - total losses
        - total attacks
        - total defends
        - total kills
        - total deaths
        - total assists
        - total points
        - average players per event
        - average players per campaign
        - ... idk other fun data
