# helldivers.bot

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

#### Build locally

docker build -t ghcr.io/elfensky/helldivers1api:dev .
docker buildx build --platform linux/amd64 -t ghcr.io/elfensky/helldivers1api:dev .
Use `docker compose up` to run the container locally.

#### Deploy to ghcr.io

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
