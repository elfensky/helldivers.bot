import { tryCatch } from '@/shared/utils/tryCatch.mjs';
import { readOptOut } from '@/shared/components/AnalyticsOptOut';

/**
 * The visitor's answer to the Ministry of Truth recording prompt (#617). Storing
 * the answer is what makes the choice work, so it needs no consent of its own.
 */
export const REPLAY_CONSENT_KEY = 'hd1.replay-consent';

/**
 * @typedef {'yes' | 'no'} ReplayAnswer
 */

/**
 * Reads the stored answer. Wrapped in a promise because `tryCatch` only takes
 * promises.
 *
 * @returns {Promise<ReplayAnswer | null | undefined>} The answer; `undefined`
 *   when there is no answer yet; `null` when storage threw (callers fail closed).
 */
export async function readReplayConsent() {
    const { data, error } = await tryCatch(
        Promise.resolve().then(() => localStorage.getItem(REPLAY_CONSENT_KEY)),
    );
    if (error) return null;
    return data === 'yes' || data === 'no' ? data : undefined;
}

/**
 * Stores or clears the answer.
 *
 * @param {ReplayAnswer | null} answer - The answer; `null` clears it.
 * @returns {Promise<boolean>} True when the write succeeded, false when storage threw.
 */
export async function writeReplayConsent(answer) {
    const { error } = await tryCatch(
        Promise.resolve().then(() =>
            answer === null ?
                localStorage.removeItem(REPLAY_CONSENT_KEY)
            :   localStorage.setItem(REPLAY_CONSENT_KEY, answer),
        ),
    );
    return !error;
}

/**
 * Whether the browser sends Global Privacy Control or Do Not Track. With either
 * signal, replay, the preference snapshot and `identify()` never run
 * (analytics-standard decision 7).
 *
 * @returns {boolean}
 */
export function privacySignal() {
    if (typeof navigator === 'undefined') return false;
    const nav = /** @type {Navigator & { globalPrivacyControl?: boolean }} */ (navigator);
    const win = /** @type {Window & { doNotTrack?: string }} */ (window);
    return (
        nav.globalPrivacyControl === true ||
        nav.doNotTrack === '1' ||
        win.doNotTrack === '1'
    );
}

/**
 * The one gate for session replay and the preference snapshot: a stored yes, a
 * readable opt-out flag that is not set, no account link on this page load
 * (replay and identity never share a page load, trap 22), and no privacy signal.
 *
 * @param {object} state - What the browser and the session say.
 * @param {ReplayAnswer | null | undefined} state.consent - From readReplayConsent().
 * @param {boolean | null} state.optOut - From readOptOut(); `null` = storage threw.
 * @param {boolean} state.identified - The account link is on for this page load.
 * @param {boolean} state.signal - From privacySignal().
 * @returns {boolean}
 */
export function canReplay({ consent, optOut, identified, signal }) {
    return (
        consent === 'yes' && optOut === false && identified === false && signal === false
    );
}

/**
 * Reads the browser's state and applies {@link canReplay}.
 *
 * @param {boolean} identified - The account link is on for this page load.
 * @returns {Promise<boolean>}
 */
export async function replayAllowed(identified) {
    return canReplay({
        consent: await readReplayConsent(),
        optOut: await readOptOut(),
        identified,
        signal: privacySignal(),
    });
}
