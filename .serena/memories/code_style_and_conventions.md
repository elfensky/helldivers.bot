# Code Style and Conventions - helldivers.bot

## Formatting (Prettier)

Configuration in `.prettierrc`:
- **Semi:** true (semicolons required)
- **Tab Width:** 4 spaces
- **Quotes:** Single quotes
- **Trailing Comma:** all
- **Print Width:** 90 characters
- **Tailwind Plugin:** enabled with `prettier-plugin-tailwindcss`
- **Experimental Ternaries:** enabled

Run `npm run format` for auto-formatting (watch mode).

## Path Aliases

Configured in `jsconfig.json`:
- `@/*` maps to `./src/*`

Example: `import { db } from '@/db/db.js'`

## Code Patterns

### Error Handling
Uses custom `tryCatch` wrapper throughout codebase:
```javascript
const { data, error } = await tryCatch(someAsyncOperation());
if (error) { /* handle */ }
```
**Do NOT use traditional try/catch blocks.**

### Performance Tracking
All API routes measure execution time using `perf_hooks`:
```javascript
import { roundedPerformanceTime } from '@/utils/performance.mjs';
// Returns timing in response
```

### Validation
All external data must be validated with Zod schemas before database operations.
Schemas located in `src/validators/`.

### Server Actions
Mark utilities with `'use server'` directive for server-side execution.

## File Conventions

- **Extensions:** `.js`, `.jsx` for React, `.mjs` for pure Node.js modules
- **Prisma Client:** Generated at `src/generated/prisma/` (custom output path)
- **Components:** Located in `src/components/` with subdirectories by feature

## Naming Conventions

- **Files:** kebab-case or camelCase (e.g., `status.mjs`, `tryCatch.mjs`)
- **Components:** PascalCase (e.g., `Navigation.jsx`)
- **Functions:** camelCase
- **Database tables:** snake_case with prefix (`h1_`, `rebroadcast_`)
