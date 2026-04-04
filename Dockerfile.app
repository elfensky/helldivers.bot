# LOCAL BUILD: docker build -f ./Dockerfile.app -t ghcr.io/elfensky/helldiversbot:staging .
FROM node:24-alpine AS base
# Install tini to avoid zombie processes
RUN apk add --no-cache tini

#region deps
# Install dependencies only when needed
FROM base AS deps
# Check https://github.com/nodejs/docker-node/tree/b4117f9333da4138b03a546ec926ef50a31506c3#nodealpine to understand why libc6-compat might be needed.
# RUN apk add --no-cache libc6-compat # disable this, as it prevents Prisma from running https://www.prisma.io/docs/guides/docker
WORKDIR /app
# Install dependencies based on the preferred package manager
COPY package.json package-lock.json ./
RUN \
    if [ -f package-lock.json ]; then npm ci; \
    else echo "Lockfile not found." && exit 1; \
    fi
#endregion

#region builder
# Rebuild the source code only when needed
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# Generate the Prisma client
RUN POSTGRES_URL=postgresql://dummy npx prisma generate
# Next.js collects completely anonymous telemetry data about general usage.
# Learn more here: https://nextjs.org/telemetry
# Uncomment the following line in case you want to disable telemetry during the build.
# ENV NEXT_TELEMETRY_DISABLED=1
RUN \
    if [ -f package-lock.json ]; then npm run build; \
    else echo "Lockfile not found." && exit 1; \
    fi
#endregion

#region runner
# copy the build files for a minimal image, add prisma and run the server
FROM base AS runner
WORKDIR /app
# Pass the version from the build step
ARG VERSION 
# Label the container
LABEL org.opencontainers.image.source="https://github.com/elfensky/helldivers.bot"
LABEL org.opencontainers.image.licenses="MIT"
LABEL org.opencontainers.image.title="Helldivers Bot"
LABEL version="${VERSION}"
LABEL description="nextjs application that serves as an api rebroadcaster and formatter for Helldivers 1"
# defaults to production, but can be overriden at build time
ARG NODE_ENV=production 
ENV NODE_ENV=$NODE_ENV
# Automatically leverage output traces to reduce image size
# https://nextjs.org/docs/advanced-features/output-file-tracing
COPY --from=builder --chown=node:node /app/.next/standalone ./
COPY --from=builder --chown=node:node /app/.next/static ./.next/static
COPY --from=builder --chown=node:node /app/public ./public
# Run as non-root user (node user is built into node:*-alpine images)
USER node
EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"
# Set tini as the init system
ENTRYPOINT ["/sbin/tini", "--"]
# server.js is created by next build from the standalone output
# https://nextjs.org/docs/pages/api-reference/config/next-config-js/output
CMD ["node", "server.js"] 
# CMD ["npm", "run", "start"]
# healthcheck using a standard api route in the application
HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
    CMD curl -f http://0.0.0.0:3000/api/healthcheck || exit 1
#endregion