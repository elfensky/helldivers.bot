# OG Image File Convention Migration — Design Spec

**Date:** 2026-03-28
**Status:** Draft
**Reviewed by:** Multi-AI debate (Sonnet, Gemini, Opus)

## Problem

The app has two competing OG image sources:

1. **Static file** — `src/app/opengraph-image.png` (4.6MB PNG screenshot from Dec 2025). Next.js auto-resolves this as the OG image via file-based metadata convention.
2. **Dynamic API route** — `src/app/api/og/route.js` (Satori-based, renders live war data + galaxy map). Referenced manually in `layout.jsx` metadata.

Next.js file-based metadata always overrides config-based metadata. The static file wins, producing:
```
og:image="https://helldivers.bot/opengraph-image.png?opengraph-image.0mralz0sy0p7_.png"
```

The dynamic route is never used for OG tags. Additionally, the dynamic route has a bug: `events` is referenced but never defined (the variable is `activeEvents`), so it would crash at runtime anyway.

## Solution

Migrate to the Next.js `opengraph-image.jsx` file convention. Delete the static PNG and convert the API route into a file-convention dynamic OG image.

## File Changes

### Delete

- `src/app/opengraph-image.png` — static 4.6MB PNG (the conflict source)
- `src/app/opengraph-image.alt.txt` — alt text for the static file
- `src/app/api/og/route.js` — replaced by file convention
- `src/app/api/og/` — empty directory after route removal

### Create

- `src/app/opengraph-image.jsx` — dynamic OG image using Next.js file convention

### Modify

- `src/app/layout.jsx` — update metadata config

## opengraph-image.jsx

The new file uses the [Next.js dynamic OG image file convention](https://nextjs.org/docs/app/api-reference/file-conventions/metadata/opengraph-image#generate-images-using-code-js-ts-tsx).

### Required named exports

```js
export const revalidate = 300;    // ISR: regenerate every 5 minutes
export const alt = 'Helldivers 1 galactic war status map with faction progress';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';
```

### Default export

```js
export default async function Image() {
    // ... Satori JSX rendering logic (moved from route.js GET handler)
}
```

### Key differences from route.js

1. **Export style:** `export default async function Image()` instead of `export async function GET()`
2. **No `headers` option:** Remove `headers: CACHE_HEADERS` from both `ImageResponse` calls (main and fallback). Next.js controls response headers for file-convention metadata. Caching is handled by `export const revalidate = 300` (ISR).
3. **Event variables bug fix:** Define two separate variables:
   ```js
   const events = data.events || [];                          // full list — for status text
   const activeEvents = events.filter((e) => e.status === 'active'); // filtered — for map state
   ```
   - `activeEvents` feeds `computeMapState()` — only active events affect sector ownership
   - `events` feeds the status text logic — needs completed events to show "DEFEND WON"/"ATTACK LOST"

### What stays the same

- All Satori JSX rendering (colors, map SVG, layout, faction bars)
- `COLORS`, `FACTION_*` constants
- `buildMapSvg()`, `getSectorFill()`, `getSectorStroke()` helpers
- `fallbackImage()` function (minus the `headers` option)
- All imports (`getCampaign`, `computeMapState`, `tryCatch`, `mapPaths`)

## layout.jsx metadata

### Before

```js
export const metadata = {
    metadataBase: 'https://helldivers.bot',
    title: '...',
    description: '...',
    openGraph: {
        images: ['/api/og'],
    },
    twitter: {
        card: 'summary_large_image',
        images: ['/api/og'],
    },
};
```

### After

```js
export const metadata = {
    metadataBase: new URL('https://helldivers.bot'),
    title: '...',
    description: '...',
    openGraph: {
        type: 'website',
        url: 'https://helldivers.bot',
    },
    twitter: {
        card: 'summary_large_image',
    },
};
```

Changes:
- `metadataBase` → `new URL(...)` instead of plain string (Next.js expects URL instance)
- Remove `openGraph.images` — auto-generated from `opengraph-image.jsx`
- Remove `twitter.images` — auto-generated from `opengraph-image.jsx`
- Add `openGraph.type: 'website'` — fixes missing `og:type` tag
- Add `openGraph.url` — fixes missing `og:url` tag

## Caching

| Before (API route) | After (file convention) |
|---|---|
| `Cache-Control: public, s-maxage=300, stale-while-revalidate=60` | `export const revalidate = 300` (ISR) |
| Manual CDN headers | Next.js manages headers |
| Explicit SWR window | ISR handles background revalidation |

For the self-hosted Docker deployment: ensure `.next/cache` is writable and persisted across container restarts for ISR to work correctly.

## Generated meta tags

After migration, Next.js will auto-generate:

```html
<meta property="og:type" content="website" />
<meta property="og:url" content="https://helldivers.bot" />
<meta property="og:title" content="Helldivers Bot - Live war dashboard for the original Helldivers" />
<meta property="og:description" content="Live Helldivers 1 war dashboard..." />
<meta property="og:image" content="https://helldivers.bot/opengraph-image" />
<meta property="og:image:width" content="1200" />
<meta property="og:image:height" content="630" />
<meta property="og:image:type" content="image/png" />
<meta property="og:image:alt" content="Helldivers 1 galactic war status map with faction progress" />
<meta name="twitter:card" content="summary_large_image" />
<meta name="twitter:image" content="https://helldivers.bot/opengraph-image" />
```

## Verification

After implementation:
1. `npm run build` — confirm no errors
2. `npm run test:unit:run` — confirm no regressions
3. Check rendered HTML for correct `og:image` pointing to `/opengraph-image` (not the old static hash)
4. Visit `/opengraph-image` directly in browser — confirm dynamic image renders
5. Test with an OG debugger (e.g., opengraph.xyz) after deployment

## Risks & Mitigations

| Risk | Severity | Mitigation |
|---|---|---|
| Stale static PNG in `.next/` cache | Low | Clean build: `rm -rf .next && npm run build` |
| External services hardcoded to `/api/og` | Low | Check if Discord bot or other integrations reference this URL |
| ISR not working in Docker | Medium | Ensure `.next/cache` is writable and persisted |
