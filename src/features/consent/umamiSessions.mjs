import { tryCatch } from '@/shared/utils/tryCatch.mjs';
import {
    isValidUmamiSessionDetail,
    isValidUmamiSessionPage,
} from '@/validators/isValidUmamiSession.mjs';

const PAGE_SIZE = 100;
// shortcut: stops after 50 pages (5,000 candidate sessions) and reports a failure; raise it if one account ever has more.
const MAX_PAGES = 50;

/**
 * Fetches one Umami API path with the API key and validates the JSON answer.
 *
 * @template T
 * @param {string} url - Absolute Umami API URL.
 * @param {string} key - Umami API key.
 * @param {import('zod').ZodType<T>} schema - Schema for the answer.
 * @returns {Promise<T | null>} The parsed answer; null on any failure.
 */
async function getJson(url, key, schema) {
    const { data, error } = await tryCatch(
        fetch(url, { headers: { Authorization: `Bearer ${key}` } }).then((res) =>
            res.ok ? res.json() : null,
        ),
    );
    if (error || data === null) return null;
    const check = schema.safeParse(data);
    return check.success ? check.data : null;
}

/**
 * Deletes the Umami sessions linked to one account, through Umami's own API, when
 * the account link is withdrawn or the account is deleted (analytics-standard
 * §5.2). Umami's delete removes the session and every dependent row.
 *
 * `search` matches the distinct id, city, browser, OS or device as a substring,
 * so each candidate is checked with the session detail: only a session whose one
 * linked distinct id is this account is deleted. A session linked to more than
 * one distinct id holds other people's data too; it is left alone and the call
 * reports a failure, so the operator handles it by hand. The same happens when
 * Umami links more sessions to the account than the search found.
 *
 * Needs `UMAMI_SITE_URL`, `UMAMI_SITE_ID` and `UMAMI_API_KEY` (Umami ≥ 3.4.0).
 *
 * @param {string} userId - The account id, as passed to umami.identify().
 * @returns {Promise<boolean>} True when every linked session is gone.
 */
export async function deleteLinkedSessions(userId) {
    const {
        UMAMI_SITE_URL: host,
        UMAMI_SITE_ID: websiteId,
        UMAMI_API_KEY: key,
    } = process.env;
    if (!host || !websiteId || !key || !userId) return false;

    const base = `https://${host}/api/websites/${encodeURIComponent(websiteId)}/sessions`;

    /** @type {string[]} */
    const candidates = [];
    for (let page = 1; ; page++) {
        if (page > MAX_PAGES) return false;
        const query = new URLSearchParams({
            startAt: '0',
            endAt: String(Date.now()),
            search: userId,
            page: String(page),
            pageSize: String(PAGE_SIZE),
        });
        const result = await getJson(`${base}?${query}`, key, isValidUmamiSessionPage);
        if (!result) return false;
        candidates.push(...result.data.map((s) => s.id));
        if (result.data.length === 0 || page * PAGE_SIZE >= result.count) break;
    }

    let complete = true;
    /** @type {string[]} */
    const own = [];
    let linked = 0;
    for (const id of new Set(candidates)) {
        const detail = await getJson(`${base}/${id}`, key, isValidUmamiSessionDetail);
        if (!detail) return false;
        if (!detail.distinctIds.includes(userId)) continue;
        if (detail.distinctIds.length !== 1) {
            complete = false;
            continue;
        }
        own.push(id);
        linked = Math.max(linked, detail.stitchedSessionCount);
    }
    if (linked > own.length) complete = false;

    for (const id of own) {
        const { data: res, error } = await tryCatch(
            fetch(`${base}/${id}`, {
                method: 'DELETE',
                headers: { Authorization: `Bearer ${key}` },
            }),
        );
        // 404: already gone, which is the goal.
        if (error || (!res.ok && res.status !== 404)) return false;
    }
    return complete;
}
