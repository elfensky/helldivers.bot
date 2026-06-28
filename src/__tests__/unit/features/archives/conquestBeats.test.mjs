import { describe, it, expect } from 'vitest';
import { buildConquestBeats } from '@/features/archives/conquestBeats.mjs';

const pointsMax = { points: [1000, 1000, 1000] };
const snap = (day, states) => ({ time: (day - 1) * 86400, data: states });
// states: array of { enemy, points, status }
const f = (enemy, points, status = 'active') => ({ enemy, points, status });

describe('buildConquestBeats', () => {
    it('returns [] when no faction reaches the gates and none is defeated', () => {
        const snapshots = [
            snap(1, [f(0, 100), f(1, 50), f(2, 0)]),
            snap(2, [f(0, 300), f(1, 200), f(2, 100)]),
        ];
        expect(buildConquestBeats(snapshots, pointsMax, 155, 0)).toEqual([]);
    });

    it('emits a breakthrough at the gates threshold (0.9)', () => {
        const snapshots = [
            snap(1, [f(0, 500), f(1, 0), f(2, 0)]),
            snap(3, [f(0, 950), f(1, 0), f(2, 0)]), // bugs cross 0.9
        ];
        const beats = buildConquestBeats(snapshots, pointsMax, 155, 0);
        expect(beats.length).toBe(1);
        expect(beats[0].day).toBe(3);
        expect(beats[0].text).toMatch(/Bugs/);
    });

    it('emits "first homeworld falls" on the first defeated faction', () => {
        const snapshots = [
            snap(2, [f(0, 950), f(1, 0), f(2, 0)]), // breakthrough day 2
            snap(4, [f(0, 1000, 'defeated'), f(1, 0), f(2, 0)]), // falls day 4
        ];
        const beats = buildConquestBeats(snapshots, pointsMax, 155, 0);
        // ≤2; breakthrough (day2) + falls (day4), different days → both kept
        expect(beats.length).toBe(2);
        expect(beats.some((b) => /falls|routed/i.test(b.text))).toBe(true);
    });
});
