# Suggested Commands - helldivers.bot

## Development

```bash
# Install dependencies
npm install

# Start dev server with Turbopack
npm run dev

# Build for production
npm run build

# Start production server (standalone output)
npm start

# Auto-format code with Prettier (watch mode)
npm run format
```

## Database (Prisma)

```bash
# Generate Prisma Client (custom path: src/generated/prisma/)
npx prisma generate

# Create and apply migration (development)
npx prisma migrate dev
npx prisma migrate dev --name <migration_name>

# Push schema without migration (prototyping only)
npx prisma db push

# Reset database (destructive!)
npx prisma migrate reset

# Apply pending migrations (production)
npx prisma migrate deploy
```

## Docker

```bash
# Build locally (native architecture)
docker build -t ghcr.io/elfensky/helldiversbot:staging .

# Build for x86_64/amd64 (production deployment)
docker buildx build --platform linux/amd64 -t ghcr.io/elfensky/helldiversbot:staging .

# Run locally with docker-compose
docker compose up

# Push to registry
docker push ghcr.io/elfensky/helldiversbot:staging
```

**Note:** Database must exist before running Docker container.

## System Commands (macOS/Darwin)

```bash
# File operations
ls -la                    # List files with details
find . -name "*.js"       # Find files by pattern
grep -r "pattern" src/    # Search in files

# Git
git status
git log --oneline -10
git diff

# Process management
lsof -i :3000            # Check what's using port 3000
```
