import { describe, it, expect } from 'vitest';
import { buildPlayerBeats } from '@/features/archives/playerBeats.mjs';

const pt = (day, total) => ({ time: day * 86400, day, total });

describe('buildPlayerBeats', () => {
    it('returns [] for empty or single-point series', () => {
        expect(buildPlayerBeats([], 157)).toEqual([]);
        expect(buildPlayerBeats([pt(1, 100)], 157)).toEqual([]);
    });

    it('emits a surge and a collapse on a series that clears the thresholds', () => {
        // baseline ~1000; spike to 5000 (surge), crater to 200 (collapse)
        const series = [
            pt(1, 50), // opening ramp — ignored for collapse
            pt(2, 1000),
            pt(3, 1000),
            pt(4, 5000), // surge
            pt(5, 1000),
            pt(6, 200), // collapse
            pt(7, 1000),
        ];
        const beats = buildPlayerBeats(series, 157);
        const kinds = beats.map((b) => b.kind).sort();
        expect(kinds).toEqual(['collapse', 'surge']);
        expect(beats.length).toBe(2);
        // anchored at the right buckets
        expect(beats.find((b) => b.kind === 'surge').day).toBe(4);
        expect(beats.find((b) => b.kind === 'collapse').day).toBe(6);
    });

    it('emits nothing on a flat series (no bucket clears the thresholds)', () => {
        const series = [pt(1, 0), pt(2, 1000), pt(3, 1010), pt(4, 990), pt(5, 1000)];
        expect(buildPlayerBeats(series, 157)).toEqual([]);
    });
});
