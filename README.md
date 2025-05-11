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

#### Build local

docker build -t elfensky/helldivers1api:latest .

#### Build production

docker buildx build --platform linux/amd64 -t elfensky/helldivers1api:latest . --push

## Deploy to production

1. docker pull elfensky/h1api:latest
2. create an .env file with the same variables as above and note its path
3. create a docker-compose.yml file with the following content:
