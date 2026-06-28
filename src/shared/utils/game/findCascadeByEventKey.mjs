import { eventKey } from '@/shared/utils/game/eventKey.mjs';

/**
 * Resolve an `eventKey` string (e.g. "defend-12345", no leading '#') to the
 * cascade whose `events` array contains that event. Used to turn a deep-link
 * URL hash back into a cascade. Returns `null` when nothing matches.
 *
 * @param {Array<{ events?: Array<object> }>} cascades - Cascades to search.
 * @param {string} key - An eventKey string with the leading '#' already stripped.
 * @returns {object | null} The matching cascade, or null.
 */
export function findCascadeByEventKey(cascades, key) {
    if (!cascades?.length || !key) return null;
    return cascades.find((c) => c.events?.some((e) => eventKey(e) === key)) ?? null;
}
