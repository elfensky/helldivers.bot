# CHANGELOG

Given a version number MAJOR.MINOR.PATCH, increment the:

- MAJOR version when you make incompatible API changes
- MINOR version when you add functionality in a backward compatible manner
- PATCH version when you make backward compatible bug fixes

## x.x.x (YYYY-MM-DD)

- To be copied from RELEASE.md

## 0.4.2 (2025-05-28)

- migrate openapi generation to instrumentation.js -> npm run build removes all comments from the code, so it cannot be generated live.
- add umami.js
- add Galactic Map
- add Stats
- Docker fixes
- Hosted and available at staging.helldivers.bot

## 0.4.1 (2025-05-20)

- create `/api/openapi` route.js that uses swagger-jsdoc and the JSDoc comments in `/api/h1/\*\*/\*.js` to generate an OpenAPI spec.
- create `/docs` page.jsx that uses swagger-ui-dist to render the OpenAPI spec.

## 0.4.0 (2025-05-20)

- implement Prisma Models for helldivers1 data
- POST /api/h1/rebroadcast
    - get_campaign_status
    - get_snapshots
- updateStatus.mjs
- updateSnapshot.mjs
- validate works in docker

## 0.3.3 (2025-05-19)

- Flesh out the Dashboard
    - Show list of API keys
    - Create new API key
    - Delete existing API key
- zod for validation
- Validate works in docker

## 0.3.2 (2025-05-15)

- Add nodemailer provider to auth
- Flesh out Frontend layout
- Add json-ld to Homepage
- Create Posts button ("use server")
- Show Posts

## 0.3.1 (2025-05-12)

- Validate auth still works in docker

## 0.3.0 (2025-05-12)

- Add dependencies for next-auth
- Configure [Auth](https://authjs.dev/getting-started/installation?framework=Next.js)
- Adjust Prisma Schema to support authentication
- Add pages and components to handle authentication

## 0.2.0 (2025-05-11)

- Change Github Actions to only build for amd64 -> this is so I can properly use the Labels in the Dockerfile, without requiring the use of annotations. [read more](https://docs.github.com/en/packages/working-with-a-github-packages-registry/working-with-the-container-registry#adding-a-description-to-multi-arch-images)
- Added and configured PrismaORM
- Added .example.env file
- Switched whole project to JavaScript (once again I am convinced typescript doesn't actually help, but only put spokes in your wheels).
- Working Docker build with PrismaORM

## 0.1.0 (2025-05-10)

- initialize project with `npx create-next-app@latest`
- Configure next.config.js to use output: 'standalone', which will be used by the container
- Configure Dockerfile, docker-compose.yml and .dockerignore to build a working container
- Configure Prettier and make it sort Tailwind CSS classes
- Add Chokidar to watch for changes in the src folder and run linting and prettier
- Add README.md, CHANGELOG.md, LICENSE
- Add Github Action to manually build the container and push it to Github Container Registry
- Add labels to Dockerfile
- Add some folder structure to the project
    - src/app -> routable content
    - src/components -> reusable components
- Add Github Action to automatically build and push the container to Github Container Registry on every tagged commit, and create a new release on Github.
