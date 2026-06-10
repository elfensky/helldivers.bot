import { describe, it, expect } from 'vitest';
import { computeThreatData } from '@/features/stats/FactionThreatRanking';

// The chart itself uses Recharts in a ResponsiveContainer, which doesn't
// render usefully in jsdom (no real dimensions) — so the unit test covers
// the pure data transform that drives it. The chart is exercised end-to-end
// by the DevTools verify.

describe('computeThreatData', () => {
    it('computes the overall HD win rate per faction and sorts ascending', () => {
        const totals = [
            // Bugs: (60+30)/(100+50) = 90/150 = 60%
            { enemy: 0, defends: 100, defend_wins: 60, attacks: 50, attack_wins: 30 },
            // Cyborgs: (40+20)/(80+60) = 60/140 ≈ 43%
            { enemy: 1, defends: 80, defend_wins: 40, attacks: 60, attack_wins: 20 },
            // Illuminate: (30+40)/(50+50) = 70/100 = 70%
            { enemy: 2, defends: 50, defend_wins: 30, attacks: 50, attack_wins: 40 },
        ];
        const data = computeThreatData(totals);
        expect(data).toHaveLength(3);
        // Ascending by winRate → most threatening (lowest HD win rate) at top.
        expect(data[0]).toMatchObject({ name: 'Cyborgs', winRate: 43 });
        expect(data[1]).toMatchObject({ name: 'Bugs', winRate: 60 });
        expect(data[2]).toMatchObject({ name: 'Illuminate', winRate: 70 });
    });

    it('treats a missing faction as zero rather than dropping it', () => {
        const data = computeThreatData([
            { enemy: 0, defends: 10, defend_wins: 5, attacks: 5, attack_wins: 3 },
        ]);
        expect(data).toHaveLength(3);
        const cyborgs = data.find((d) => d.name === 'Cyborgs');
        expect(cyborgs.winRate).toBe(0);
    });

    it('returns empty when factionTotals is empty', () => {
        // Every faction registers but with zeros — empty array still yields
        // three rows so the chart has consistent axis labels.
        const data = computeThreatData([]);
        expect(data).toHaveLength(3);
        expect(data.every((d) => d.winRate === 0)).toBe(true);
    });
});
