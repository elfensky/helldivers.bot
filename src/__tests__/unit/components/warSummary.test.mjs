// src/__tests__/unit/components/warSummary.test.mjs
import { describe, it, expect } from 'vitest';
import { computeWarSummary } from '@/components/h1/WarSummary/WarSummary';

describe('computeWarSummary', () => {
    it('returns zero counts for no events', () => {
        expect(computeWarSummary([])).toEqual({ wins: 0, losses: 0 });
    });

    it('counts wins and losses', () => {
        const events = [
            { status: 'success' },
            { status: 'success' },
            { status: 'fail' },
            { status: 'active' },
        ];
        expect(computeWarSummary(events)).toEqual({ wins: 2, losses: 1 });
    });

    it('ignores active events', () => {
        const events = [{ status: 'active' }, { status: 'active' }];
        expect(computeWarSummary(events)).toEqual({ wins: 0, losses: 0 });
    });
});
