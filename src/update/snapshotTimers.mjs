import db from '@/db/db';
import { tryCatch } from '@/utils/tryCatch';

// In-memory last-snapshot timestamps. Keyed by type.
// Seeded from DB on first check, updated in memory after each write.
let currentSeason = null;
let lastLiveSnapshotTime = null;
const lastEventSnapshotTimes = new Map(); // key: `${type}:${event_id}`, value: time

function resetIfSeasonChanged(season) {
    if (currentSeason !== null && currentSeason !== season) {
        lastLiveSnapshotTime = null;
        lastEventSnapshotTimes.clear();
    }
    currentSeason = season;
}

const LIVE_SNAPSHOT_INTERVAL = 900; // 15 minutes in seconds
const EVENT_SNAPSHOT_INTERVAL = 600; // 10 minutes in seconds

/**
 * Check if enough time has passed to take a live snapshot.
 * On first call (cold start), queries DB for the last snapshot time.
 * Returns true if a snapshot should be taken.
 */
export async function shouldTakeLiveSnapshot(season, apiTime) {
    resetIfSeasonChanged(season);

    if (lastLiveSnapshotTime === null) {
        // Cold start: seed from DB
        const { data: row, error } = await tryCatch(
            db.h1_live_snapshot.findFirst({
                where: { season },
                orderBy: { time: 'desc' },
                select: { time: true },
            }),
        );
        if (error) throw error;
        lastLiveSnapshotTime = row?.time ?? 0;
    }

    return apiTime - lastLiveSnapshotTime >= LIVE_SNAPSHOT_INTERVAL;
}

/**
 * Update the in-memory timer after a successful live snapshot write.
 */
export function recordLiveSnapshotTime(time) {
    lastLiveSnapshotTime = time;
}

/**
 * Check if enough time has passed to take an event snapshot.
 * On first call per event (cold start), queries DB.
 * Returns true if a snapshot should be taken.
 */
export async function shouldTakeEventSnapshot(type, eventId, apiTime) {
    const key = `${type}:${eventId}`;

    if (!lastEventSnapshotTimes.has(key)) {
        // Cold start: seed from DB
        const { data: row, error } = await tryCatch(
            db.h1_event_snapshot.findFirst({
                where: { type, event_id: eventId },
                orderBy: { time: 'desc' },
                select: { time: true },
            }),
        );
        if (error) throw error;
        lastEventSnapshotTimes.set(key, row?.time ?? 0);
    }

    return apiTime - lastEventSnapshotTimes.get(key) >= EVENT_SNAPSHOT_INTERVAL;
}

/**
 * Update the in-memory timer after a successful event snapshot write.
 */
export function recordEventSnapshotTime(type, eventId, time) {
    const key = `${type}:${eventId}`;
    lastEventSnapshotTimes.set(key, time);
}

/**
 * Reset all timers. Called if season changes.
 */
export function resetSnapshotTimers() {
    lastLiveSnapshotTime = null;
    lastEventSnapshotTimes.clear();
}
