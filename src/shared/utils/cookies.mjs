'use client';

const ONE_YEAR_SECONDS = 60 * 60 * 24 * 365;

/**
 * Write a user-preference cookie. Functional/strictly-necessary category
 * under GDPR — no tracking, no cross-site. Path=/ so every route reads it,
 * SameSite=Lax to allow top-level navigations, Secure on HTTPS.
 */
export function setPreferenceCookie(key, value) {
    const secure = location.protocol === 'https:' ? '; Secure' : '';
    document.cookie = `${key}=${value}; path=/; max-age=${ONE_YEAR_SECONDS}; SameSite=Lax${secure}`;
}

/**
 * Client-side cookie reader for preference values. Server components should
 * use `cookies()` from `next/headers` instead — this helper is only for
 * client-side consumers (e.g., analytics snapshot).
 */
export function readPreferenceCookie(key) {
    const match = document.cookie.match(new RegExp(`(?:^|; )${key}=([^;]*)`));
    return match ? match[1] : null;
}
