import { computeFrontier } from '@/components/h1/Galaxy/EventCard';

describe('computeFrontier', () => {
    const makeCampaign = (points, pointsMax, status = 'active') => ({
        points,
        points_max: pointsMax,
        status,
        enemy: 0,
    });

    const makeFactionMap = (overrides = {}) => {
        const map = {};
        for (let i = 1; i <= 10; i++) {
            map[i] = { region: `Region ${i}`, event: 'idle', ...overrides[i] };
        }
        return map;
    };

    test('returns null when campaignData is null', () => {
        expect(computeFrontier(null, makeFactionMap())).toBeNull();
    });

    test('returns null when campaignData is undefined', () => {
        expect(computeFrontier(undefined, makeFactionMap())).toBeNull();
    });

    test('returns null when factionMap is null', () => {
        expect(computeFrontier(makeCampaign(50000, 100000), null)).toBeNull();
    });

    test('returns null when status is not active', () => {
        expect(
            computeFrontier(makeCampaign(50000, 100000, 'defeated'), makeFactionMap()),
        ).toBeNull();
    });

    test('50k/100k points returns sector 6 frontier with correct percent', () => {
        const result = computeFrontier(makeCampaign(50000, 100000), makeFactionMap());
        expect(result.sector).toBe(6);
        expect(result.percent).toBe(0); // exactly at boundary
        expect(result.region).toBe('Region 6');
    });

    test('zero points returns sector 1 frontier', () => {
        const result = computeFrontier(makeCampaign(0, 100000), makeFactionMap());
        expect(result.sector).toBe(1);
        expect(result.percent).toBe(0);
    });

    test('all sectors captured returns null', () => {
        expect(
            computeFrontier(makeCampaign(100000, 100000), makeFactionMap()),
        ).toBeNull();
    });

    test('points exceeding max returns null', () => {
        expect(
            computeFrontier(makeCampaign(120000, 100000), makeFactionMap()),
        ).toBeNull();
    });

    test('points_max of 0 defaults to 1 avoiding division by zero', () => {
        const result = computeFrontier(makeCampaign(0, 0), makeFactionMap());
        // points_max becomes 1, points=0, frontier=1
        expect(result).not.toBeNull();
        expect(result.sector).toBe(1);
    });

    test('returns region from factionMap sector data', () => {
        const factionMap = makeFactionMap({ 3: { region: 'Kepler Prime' } });
        const result = computeFrontier(makeCampaign(20000, 100000), factionMap);
        // 20k/100k = 2 sectors earned, frontier = 3
        expect(result.sector).toBe(3);
        expect(result.region).toBe('Kepler Prime');
    });

    test('falls back to Sector N when no region in factionMap', () => {
        const factionMap = makeFactionMap();
        delete factionMap[3].region;
        const result = computeFrontier(makeCampaign(20000, 100000), factionMap);
        expect(result.region).toBe('Sector 3');
    });

    test('returns event status from factionMap sector data', () => {
        const factionMap = makeFactionMap({ 6: { event: 'active' } });
        const result = computeFrontier(makeCampaign(50000, 100000), factionMap);
        expect(result.event).toBe('active');
    });

    test('partial progress within a sector computes correct percent', () => {
        // 55000/100000: 5.5 sectors earned, frontier = 6, 50% into sector
        const result = computeFrontier(makeCampaign(55000, 100000), makeFactionMap());
        expect(result.sector).toBe(6);
        expect(result.percent).toBe(50);
        expect(result.points).toBe(5000);
        expect(result.pointsMax).toBe(10000);
    });
});
