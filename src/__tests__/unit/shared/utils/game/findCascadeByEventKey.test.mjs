import { describe, it, expect } from 'vitest';
import { findCascadeByEventKey } from '@/shared/utils/game/findCascadeByEventKey.mjs';

const ev = (type, id) => ({ type, event_id: id });
const cascade = (events) => ({ events });

describe('findCascadeByEventKey', () => {
    const c1 = cascade([ev('defend', 1), ev('defend', 2), ev('defend', 3)]);
    const c2 = cascade([ev('defend', 7), ev('defend', 8)]);
    const cascades = [c1, c2];

    it('matches an event in the middle of a cascade', () => {
        expect(findCascadeByEventKey(cascades, 'defend-2')).toBe(c1);
    });

    it('matches the first and last event of a cascade', () => {
        expect(findCascadeByEventKey(cascades, 'defend-7')).toBe(c2);
        expect(findCascadeByEventKey(cascades, 'defend-8')).toBe(c2);
    });

    it('returns null when no cascade contains the key', () => {
        expect(findCascadeByEventKey(cascades, 'defend-99')).toBeNull();
        expect(findCascadeByEventKey(cascades, 'attack-1')).toBeNull();
    });

    it('returns null for empty or missing input', () => {
        expect(findCascadeByEventKey([], 'defend-1')).toBeNull();
        expect(findCascadeByEventKey(null, 'defend-1')).toBeNull();
        expect(findCascadeByEventKey(cascades, '')).toBeNull();
    });
});
