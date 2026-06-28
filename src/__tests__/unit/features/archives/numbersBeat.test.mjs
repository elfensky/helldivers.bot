import { describe, it, expect } from 'vitest';
import { buildNumbersBeat } from '@/features/archives/numbersBeat.mjs';

describe('buildNumbersBeat', () => {
    it('returns null when telemetry is null', () => {
        expect(buildNumbersBeat(null, 100, 5, 157)).toBeNull();
    });

    it('builds a beat from totals, anchored at lastTime', () => {
        const beat = buildNumbersBeat(
            { kills: 25_000_000, missions: 4200, accidentals: 8910 },
            999000,
            12,
            157,
        );
        expect(beat.time).toBe(999000);
        expect(beat.day).toBe(12);
        expect(beat.kind).toBe('numbers');
        expect(beat.text).toMatch(/25\.0M|25,000,000/); // formatNumber output
        expect(beat.text).toMatch(/mission/i);
    });
});
