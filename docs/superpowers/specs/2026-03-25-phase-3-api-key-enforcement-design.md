# Phase 3 — API Key Enforcement

> Focus: Gate the rebroadcast endpoint behind API key validation so third-party consumers authenticate before accessing cached Helldivers API data. Protects the official API by funneling community traffic through this server.
>
> Depends on: Phase 1 (DB restructuring), Phase 2 (time-series snapshots). Phase 3 does not modify any tables from Phase 1 or 2.

## Context

The rebroadcast endpoint (`POST /api/h1/rebroadcast`) serves cached raw JSON from the official Helldivers 1 API. It exists so third-party applications hit this server instead of the official `api.helldiversgame.com`, reducing load on official infrastructure.

The API key system is **half-built**: users can generate, view, and delete API keys from the dashboard. Keys are stored as MD5 hashes in the `ApiKey` table (max 5 per user, with an `enabled` flag). However, **no endpoint validates API keys on incoming requests**. The rebroadcast endpoint is completely public.

Rate limiting is handled at the reverse proxy level (server infrastructure, outside this codebase). This phase only adds app-level API key validation.

---

## 1. API Key Validation Utility

### Location

`src/db/queries/api.mjs` — where key CRUD already lives.

### Function: `validateApiKey(request)`

1. Read `Authorization` header — expect format `Bearer <key>`
2. If missing or malformed → return `{ error: 'missing' }`
3. MD5 hash the key (same algorithm as `generateApiKey` uses)
4. Query `ApiKey` table by `hash` — single DB lookup
5. If no match → return `{ error: 'invalid' }`
6. If `enabled === false` → return `{ error: 'disabled' }`
7. Otherwise → return `{ data: { userId, keyId } }`

Uses `tryCatch` wrapper per project conventions. No try/catch blocks.

---

## 2. Rebroadcast Route Integration

### Location

`src/app/api/h1/rebroadcast/route.js`

### Changes

At the top of the POST handler, **before** content-type or form-data validation:

1. Call `validateApiKey(request)`
2. If `error === 'missing'` or `error === 'invalid'` → return `rebroadcastErrorResponse(6)` (HTTP 401)
3. If `error === 'disabled'` → return `rebroadcastErrorResponse(7)` (HTTP 403)
4. If valid → continue to existing logic unchanged

### New Error Codes

Added to the existing 0–5 range:

| Code | HTTP Status | `error_message` | Condition |
|------|-------------|-----------------|-----------|
| 6 | 401 | Unauthorized | API key missing, malformed, or not found |
| 7 | 403 | Forbidden | API key found but disabled |

The rebroadcast error envelope format (`{ time, error_code, error_message }`) stays consistent with existing error codes.

The method-not-allowed handler (GET, PUT, etc.) remains unauthenticated — no point validating a key to return 405.

---

## 3. What's NOT Included

- **No rate limiting at the app level** — reverse proxy handles IP-based abuse
- **No usage tracking or analytics per key** — future concern
- **No middleware** — validation lives in the route handler, not a global middleware. Extract later if more routes need it.
- **No changes to `/api/h1/campaign`** — stays public. Can be gated later when richer endpoints are added.
- **No changes to the API key dashboard** — CRUD works as-is
- **No CORS changes** — consumers call server-to-server, not from browsers

---

## Files to Modify

| File | Change |
|------|--------|
| `src/db/queries/api.mjs` | Add `validateApiKey(request)` function |
| `src/app/api/h1/rebroadcast/route.js` | Add key check at top of POST handler, two new error codes (6, 7) |

---

## Verification

1. `POST /api/h1/rebroadcast` without `Authorization` header → 401, error code 6
2. `POST /api/h1/rebroadcast` with `Authorization: Bearer <invalid-key>` → 401, error code 6
3. `POST /api/h1/rebroadcast` with a disabled key → 403, error code 7
4. `POST /api/h1/rebroadcast` with a valid, enabled key → existing behavior (200 with data or appropriate error)
5. `GET /api/h1/rebroadcast` (method not allowed) → 405, no key check
