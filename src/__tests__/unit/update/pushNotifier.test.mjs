import { describe, test, expect, vi } from 'vitest';

// --- Dependency mocks ---

vi.mock('web-push', () => ({ default: { setVapidDetails: vi.fn(), sendNotification: vi.fn() } }));
vi.mock('@/db/db', () => ({ default: { push_subscription: { deleteMany: vi.fn() } } }));
vi.mock('@/shared/utils/tryCatch.mjs', () => ({ tryCatch: vi.fn() }));
vi.mock('@/shared/utils/game/detectChanges.mjs', () => ({ detectChanges: vi.fn() }));

import { buildPayload } from '@/update/pushNotifier';

describe('buildPayload', () => {
    const bugAttackStarted = {
        kind: 'event_started',
        event: { enemy: 0, type: 'attack', season: 142, event_id: 58291 },
    };

    const cyborgDefendWon = {
        kind: 'event_won',
        event: { enemy: 1, type: 'defend', season: 142, event_id: 58292 },
    };

    const illuminateLost = {
        kind: 'event_lost',
        event: { enemy: 2, type: 'attack', season: 142, event_id: 58293 },
    };

    test('returns a JSON string', () => {
        const result = buildPayload(bugAttackStarted);
        expect(() => JSON.parse(result)).not.toThrow();
    });

    test('includes faction name and event type in title', () => {
        const payload = JSON.parse(buildPayload(bugAttackStarted));
        expect(payload.title).toBe('Bugs attack event started');
    });

    test('uses "won!" suffix for event_won', () => {
        const payload = JSON.parse(buildPayload(cyborgDefendWon));
        expect(payload.title).toBe('Cyborgs defend event won!');
    });

    test('uses plain suffix for event_lost', () => {
        const payload = JSON.parse(buildPayload(illuminateLost));
        expect(payload.title).toBe('The Illuminate attack event lost');
    });

    test('includes season in body', () => {
        const payload = JSON.parse(buildPayload(bugAttackStarted));
        expect(payload.body).toBe('Season 142');
    });

    test('uses faction icon', () => {
        const payload = JSON.parse(buildPayload(bugAttackStarted));
        expect(payload.icon).toBe('/icons/faction0.webp');
    });

    test('falls back to superearth icon for unknown faction', () => {
        const unknownFaction = {
            kind: 'event_started',
            event: { enemy: 99, type: 'attack', season: 1, event_id: 1 },
        };
        const payload = JSON.parse(buildPayload(unknownFaction));
        expect(payload.icon).toBe('/icons/superearth.webp');
    });
});
