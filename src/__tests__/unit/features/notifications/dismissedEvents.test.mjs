// @vitest-environment jsdom
import { describe, expect, test, beforeEach } from 'vitest';
import {
    getDismissedEvents,
    addDismissedEvent,
    isDismissedAtStatus,
} from '@/features/notifications/dismissedEvents.mjs';

const STORAGE_KEY = 'dismissed-toast-events';

describe('dismissedEvents', () => {
    beforeEach(() => {
        localStorage.clear();
    });

    describe('getDismissedEvents', () => {
        test('returns empty object when storage is empty', () => {
            expect(getDismissedEvents()).toEqual({});
        });

        test('migrates legacy string-value format to {status, ts}', () => {
            localStorage.setItem(
                STORAGE_KEY,
                JSON.stringify({ 42: 'active', 99: 'success' }),
            );
            expect(getDismissedEvents()).toEqual({
                42: { status: 'active', ts: 0 },
                99: { status: 'success', ts: 0 },
            });
        });

        test('migrates legacy array format', () => {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(['1', '2', '3']));
            expect(getDismissedEvents()).toEqual({
                1: { status: 'active', ts: 0 },
                2: { status: 'active', ts: 0 },
                3: { status: 'active', ts: 0 },
            });
        });

        test('returns empty object on malformed JSON', () => {
            localStorage.setItem(STORAGE_KEY, 'not-json{');
            expect(getDismissedEvents()).toEqual({});
        });

        test('returns empty object on null value', () => {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(null));
            expect(getDismissedEvents()).toEqual({});
        });
    });

    describe('addDismissedEvent', () => {
        test('stores id with status and timestamp', () => {
            addDismissedEvent(42, 'active');
            const record = getDismissedEvents();
            expect(record['42'].status).toBe('active');
            expect(record['42'].ts).toBeGreaterThan(0);
        });

        test('overwrites existing status for same id', () => {
            addDismissedEvent(42, 'active');
            addDismissedEvent(42, 'success');
            expect(getDismissedEvents()['42'].status).toBe('success');
        });

        test('accumulates multiple distinct ids', () => {
            addDismissedEvent(1, 'active');
            addDismissedEvent(2, 'fail');
            addDismissedEvent(3, 'success');
            const record = getDismissedEvents();
            expect(record['1'].status).toBe('active');
            expect(record['2'].status).toBe('fail');
            expect(record['3'].status).toBe('success');
        });

        test('prunes oldest entries when exceeding MAX_ENTRIES', () => {
            for (let i = 0; i < 210; i++) {
                addDismissedEvent(i, 'active');
            }
            const record = getDismissedEvents();
            expect(Object.keys(record).length).toBe(200);
        });
    });

    describe('isDismissedAtStatus', () => {
        test('returns false for id not in record', () => {
            expect(isDismissedAtStatus(42, 'active')).toBe(false);
        });

        test('returns true when dismissed status matches', () => {
            addDismissedEvent(42, 'active');
            expect(isDismissedAtStatus(42, 'active')).toBe(true);
        });

        test('returns false when dismissed status differs', () => {
            addDismissedEvent(42, 'active');
            expect(isDismissedAtStatus(42, 'success')).toBe(false);
        });

        test('handles legacy string-value format', () => {
            localStorage.setItem(STORAGE_KEY, JSON.stringify({ 42: 'active' }));
            expect(isDismissedAtStatus(42, 'active')).toBe(true);
            expect(isDismissedAtStatus(42, 'success')).toBe(false);
        });

        test('handles legacy array format', () => {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(['42']));
            expect(isDismissedAtStatus(42, 'active')).toBe(true);
            expect(isDismissedAtStatus(42, 'success')).toBe(false);
        });
    });
});
