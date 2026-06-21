/**
 * Canonical site origin, safe to import from both server and client modules.
 *
 * Reads `NEXT_PUBLIC_SITE_URL` (inlined into the client bundle by Next.js at
 * build time) so self-hosters can deploy under their own domain; falls back to
 * the production default. This is the single source for the site origin — never
 * hardcode `https://helldivers.bot` in components.
 *
 * @type {string}
 */
export const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://helldivers.bot';
