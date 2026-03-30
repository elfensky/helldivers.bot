# Phase 3 — API Key Enforcement Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Gate `POST /api/h1/rebroadcast` behind API key validation. Third-party consumers must pass a valid `Authorization: Bearer <key>` header to access cached Helldivers API data.

**Architecture:** A single validation function reads the Bearer token, MD5 hashes it, and queries the existing `ApiKey` table. The rebroadcast route calls this before any form-data processing. Two new error codes (6, 7) extend the existing rebroadcast error envelope.

**Tech Stack:** `crypto.createHash('md5')` (already imported), `tryCatch` wrapper, Prisma `findUnique` by hash.

---

## File Structure

| File                                  | Action | Responsibility                                            |
| ------------------------------------- | ------ | --------------------------------------------------------- |
| `src/db/queries/api.mjs`              | Modify | Add `validateApiKey(request)` function                    |
| `src/app/api/h1/rebroadcast/route.js` | Modify | Add key check at top of POST handler, two new error codes |
| `src/utils/openapi.registry.mjs`      | Modify | Add 401/403 responses to rebroadcast endpoint             |
| `docs/04-api-reference.md`            | Modify | Document auth requirement and new error codes             |
| `docs/TODO.md`                        | Modify | Check off Phase 3 items                                   |

---

## Task 1: Add `validateApiKey(request)` utility

**Why:** The API key CRUD exists but no function validates keys on incoming requests. This is a plain async function (not a server action) that reads the `Authorization` header directly.

**Files:**

- Modify: `src/db/queries/api.mjs`

**Reuse:**

- `createHash` from `crypto` — already imported at line 7
- `db` from `@/db/db` — already imported at line 3
- `tryCatch` from `@/utils/tryCatch` — add import (not yet imported in this file)

- [ ] **Step 1: Add `tryCatch` import**

Add at the top of `src/db/queries/api.mjs`:

```js
import { tryCatch } from '@/utils/tryCatch';
```

- [ ] **Step 2: Add `validateApiKey` function**

Add at the end of `src/db/queries/api.mjs`:

```js
/**
 * Validate an API key from the Authorization header.
 * Not a server action — called from route handlers directly.
 *
 * @param {Request} request - The incoming request
 * @returns {{ data: { userId: string, keyId: string } | null, error: string | null }}
 */
export async function validateApiKey(request) {
    const header = request.headers.get('authorization');
    if (!header || !header.startsWith('Bearer ')) {
        return { data: null, error: 'missing' };
    }

    const key = header.slice(7); // strip "Bearer "
    if (!key) {
        return { data: null, error: 'missing' };
    }

    const hash = createHash('md5').update(key).digest('hex');

    const { data: row, error: dbError } = await tryCatch(
        db.ApiKey.findUnique({
            where: { hash },
            select: { id: true, userId: true, enabled: true },
        }),
    );

    if (dbError) {
        return { data: null, error: 'invalid' };
    }

    if (!row) {
        return { data: null, error: 'invalid' };
    }

    if (!row.enabled) {
        return { data: null, error: 'disabled' };
    }

    return { data: { userId: row.userId, keyId: row.id }, error: null };
}
```

- [ ] **Step 3: Commit**

```bash
git add src/db/queries/api.mjs
git commit -m "feat: add validateApiKey utility for Bearer token validation"
```

---

## Task 2: Wire validation into rebroadcast route

**Why:** The rebroadcast endpoint is currently public. This adds the key check and two new error codes to the existing error response system.

**Files:**

- Modify: `src/app/api/h1/rebroadcast/route.js`

- [ ] **Step 1: Add import**

Add to the imports in `src/app/api/h1/rebroadcast/route.js`:

```js
import { validateApiKey } from '@/db/queries/api';
```

- [ ] **Step 2: Add error codes 6 and 7 to `rebroadcastErrorResponse()`**

Add two cases to the switch statement before `default`:

```js
case 6:
    message = 'Unauthorized';
    status = 401;
    break;
case 7:
    message = 'Forbidden';
    status = 403;
    break;
```

- [ ] **Step 3: Add key validation at top of POST handler**

Insert after `const start = performance.now();` and before the content-type check:

```js
//0.5 validate API key
const { error: keyError } = await validateApiKey(request);
if (keyError === 'disabled') {
    return rebroadcastErrorResponse(7);
}
if (keyError) {
    return rebroadcastErrorResponse(6);
}
```

Note: `disabled` maps to 403 (Forbidden), all other errors (`missing`, `invalid`) map to 401 (Unauthorized).

- [ ] **Step 4: Verify build**

Run: `npm run build`

- [ ] **Step 5: Commit**

```bash
git add src/app/api/h1/rebroadcast/route.js
git commit -m "feat: gate rebroadcast endpoint behind API key validation"
```

---

## Task 3: Update documentation

**Why:** Docs must reflect the new auth requirement and error codes.

**Files:**

- Modify: `src/utils/openapi.registry.mjs`
- Modify: `docs/04-api-reference.md`
- Modify: `docs/TODO.md`

- [ ] **Step 1: Update OpenAPI registry**

In `src/utils/openapi.registry.mjs`, add 401 and 403 responses to the rebroadcast endpoint's `responses` object:

```js
401: {
    description: 'Unauthorized. API key missing, malformed, or not found.',
    content: {
        'application/json': {
            schema: z.object({
                time: z.number(),
                error_code: z.number(),
                error_message: z.string(),
            }),
        },
    },
},
403: {
    description: 'Forbidden. API key found but disabled.',
    content: {
        'application/json': {
            schema: z.object({
                time: z.number(),
                error_code: z.number(),
                error_message: z.string(),
            }),
        },
    },
},
```

- [ ] **Step 2: Regenerate OpenAPI spec**

```bash
node -e "import('./src/utils/openapi.registry.mjs').then(m => { const spec = m.generateOpenApiSpec(); require('fs').writeFileSync('public/openapi.json', JSON.stringify(spec, null, 2)); console.log('done'); });"
```

- [ ] **Step 3: Update docs/04-api-reference.md**

Add error codes 6 and 7 to the rebroadcast error code table (Section 4). Add an **Auth** line to the rebroadcast section: `**Auth:** API key required. Pass via Authorization: Bearer <key> header.`

- [ ] **Step 4: Update docs/TODO.md**

Mark all three Phase 3 items as complete:

```markdown
- [x] Add `validateApiKey(request)` utility in `src/db/queries/api.mjs`
- [x] Integrate key validation into rebroadcast POST handler
- [x] Add error codes 6 (401 Unauthorized) and 7 (403 Forbidden)
```

- [ ] **Step 5: Build and format**

```bash
npm run build
npm run format
```

- [ ] **Step 6: Commit**

```bash
git add src/utils/openapi.registry.mjs public/openapi.json docs/04-api-reference.md docs/TODO.md
git commit -m "docs: update API reference and OpenAPI spec for Phase 3 auth"
```

---

## Verification

1. `npm run build` passes
2. Ask user to start dev server, then test:
    - `curl -X POST http://localhost:3000/api/h1/rebroadcast` → 401, error code 6
    - `curl -X POST -H "Authorization: Bearer bad-key" http://localhost:3000/api/h1/rebroadcast` → 401, error code 6
    - `curl -X POST -H "Authorization: Bearer <valid-key>" -H "Content-Type: application/x-www-form-urlencoded" -d "action=get_campaign_status" http://localhost:3000/api/h1/rebroadcast` → 200 with data
    - `curl http://localhost:3000/api/h1/rebroadcast` → 405, no key check
3. `npm run test:smoke` (ask user to start dev server first)
