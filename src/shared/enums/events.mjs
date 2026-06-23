// Object.freeze narrows the values to their string literals ('defend' /
// 'attack') instead of widening to `string`, so `EVENT_TYPE.DEFEND` is
// assignable to the `'attack' | 'defend'` params on upsertEvent /
// upsertEventProgress under checkJs. All consumers only read these values
// for equality comparison, so freezing is safe.
export const EVENT_TYPE = Object.freeze({
    DEFEND: 'defend',
    ATTACK: 'attack',
});

export const EVENT_STATUS = {
    ACTIVE: 'active',
    SUCCESS: 'success',
    FAIL: 'fail',
};

export const CAMPAIGN_STATUS = {
    ACTIVE: 'active',
    DEFEATED: 'defeated',
    HIDDEN: 'hidden',
};

export const MAP_STATUS = {
    CAPTURED: 'captured',
    IN_PROGRESS: 'in_progress',
    LOST: 'lost',
    IDLE: 'idle',
};

/**
 * Literal-union typedefs for the enum values above. Use these in JSDoc
 * `@param` / `@returns` / `@typedef` annotations instead of widening to
 * `string` — they catch typos at `tsc --noEmit` time and document the
 * actual contract.
 *
 * @typedef {'defend'|'attack'} EventType
 * @typedef {'active'|'success'|'fail'} EventStatus
 * @typedef {'active'|'defeated'|'hidden'} CampaignStatus
 * @typedef {'captured'|'in_progress'|'lost'|'idle'} MapStatus
 */

/**
 * Shape of a single event as carried through the runtime (after the worker
 * pipeline merges defend/attack events into a unified array with the
 * source `type` field added). Used by `detectChanges`, toast / push
 * notification code paths, and live data consumers.
 *
 * @typedef {object} Event
 * @property {number} event_id - HD1 event id (stable across status transitions).
 * @property {number} enemy - Faction id (0=Bugs, 1=Cyborgs, 2=Illuminate).
 * @property {number} region - Region id (1-10 for sectors, 11 for homeworld; defend events only — attack events typically have region undefined upstream but the merge step backfills 11).
 * @property {EventType} type - 'defend' or 'attack'.
 * @property {EventStatus} status - 'active' / 'success' / 'fail'.
 * @property {number} [season] - Season number; present on records read from the DB.
 * @property {number} [start_time] - Unix epoch (sec) when the event began.
 * @property {number} [end_time] - Unix epoch (sec) when the event resolves.
 * @property {number} [points] - Current points scored.
 * @property {number} [points_max] - Points required to resolve.
 */

/**
 * The four lifecycle stages a toast / push notification represents.
 * `event_started` / `event_won` / `event_lost` are emitted by `detectChanges`
 * on a poll-to-poll transition; `catch_up` is emitted by `LiveToasts` on
 * page load for events that are already active.
 *
 * @typedef {'event_started'|'event_won'|'event_lost'|'catch_up'} EventChangeKind
 */
