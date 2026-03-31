// src/__tests__/unit/utils/groupEventsByDay.test.mjs
import { describe, it, expect } from 'vitest';
import { groupEventsByDay, formatDayLabel } from '@/utils/groupEventsByDay.mjs';

const event = (id, startTime, status = 'success') => ({
    event_id: id,
    start_time: startTime,
    end_time: startTime + 3600,
    status,
    type: 'defend',
    enemy: 0,
    points: 100,
    points_max: 200,
});

describe('groupEventsByDay', () => {
    it('returns empty array for no events', () => {
        expect(groupEventsByDay([])).toEqual([]);
    });

    it('groups events by calendar day (UTC)', () => {
        const events = [
            event('a', 1774958400),
            event('b', 1774958400 + 3600),
            event('c', 1774872000),
        ];
        const groups = groupEventsByDay(events);
        expect(groups).toHaveLength(2);
        expect(groups[0].events).toHaveLength(2);
        expect(groups[1].events).toHaveLength(1);
    });

    it('sorts groups newest day first', () => {
        const events = [event('old', 1774872000), event('new', 1774958400)];
        const groups = groupEventsByDay(events);
        expect(groups[0].date).toBe('2026-03-31');
        expect(groups[1].date).toBe('2026-03-30');
    });

    it('sorts events within a group newest first', () => {
        const events = [event('early', 1774958400), event('late', 1774958400 + 7200)];
        const groups = groupEventsByDay(events);
        expect(groups[0].events[0].event_id).toBe('late');
        expect(groups[0].events[1].event_id).toBe('early');
    });
});

describe('formatDayLabel', () => {
    it('returns "TODAY" for today', () => {
        const todayStr = new Date().toISOString().slice(0, 10);
        expect(formatDayLabel(todayStr)).toBe('TODAY');
    });

    it('returns "YESTERDAY" for yesterday', () => {
        const d = new Date();
        d.setDate(d.getDate() - 1);
        const yesterdayStr = d.toISOString().slice(0, 10);
        expect(formatDayLabel(yesterdayStr)).toBe('YESTERDAY');
    });

    it('returns formatted date for older days', () => {
        const label = formatDayLabel('2026-03-15');
        expect(label).toMatch(/MARCH 15/i);
    });
});
