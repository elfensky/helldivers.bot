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

        test('returns parsed record when storage has record format', () => {
            localStorage.setItem(
                STORAGE_KEY,
                JSON.stringify({ 42: 'active', 99: 'success' }),
            );
            expect(getDismissedEvents()).toEqual({ 42: 'active', 99: 'success' });
        });

        test('migrates legacy array format to record with active status', () => {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(['1', '2', '3']));
            expect(getDismissedEvents()).toEqual({
                1: 'active',
                2: 'active',
                3: 'active',
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
        test('stores id with status', () => {
            addDismissedEvent(42, 'active');
            expect(getDismissedEvents()).toEqual({ 42: 'active' });
        });

        test('coerces numeric id to string key', () => {
            addDismissedEvent(100, 'success');
            const record = getDismissedEvents();
            expect(record['100']).toBe('success');
        });

        test('overwrites existing status for same id', () => {
            addDismissedEvent(42, 'active');
            addDismissedEvent(42, 'success');
            expect(getDismissedEvents()).toEqual({ 42: 'success' });
        });

        test('accumulates multiple distinct ids', () => {
            addDismissedEvent(1, 'active');
            addDismissedEvent(2, 'fail');
            addDismissedEvent(3, 'success');
            expect(getDismissedEvents()).toEqual({
                1: 'active',
                2: 'fail',
                3: 'success',
            });
        });
    });

    describe('isDismissedAtStatus', () => {
        test('returns false for id not in record', () => {
            expect(isDismissedAtStatus(42, 'active')).toBe(false);
        });

        test('returns true when dismissed status matches current status', () => {
            addDismissedEvent(42, 'active');
            expect(isDismissedAtStatus(42, 'active')).toBe(true);
        });

        test('returns false when dismissed status differs from current status', () => {
            addDismissedEvent(42, 'active');
            expect(isDismissedAtStatus(42, 'success')).toBe(false);
            expect(isDismissedAtStatus(42, 'fail')).toBe(false);
        });

        test('respects migrated legacy entries as active dismissals', () => {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(['42']));
            expect(isDismissedAtStatus(42, 'active')).toBe(true);
            expect(isDismissedAtStatus(42, 'success')).toBe(false);
        });
    });
});
