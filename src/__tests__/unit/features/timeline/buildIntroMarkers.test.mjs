import { buildIntroMarkers } from '@/features/timeline/buildIntroMarkers.mjs';

const DAY = 86400;
const WAR_START = 1_700_000_000;

// HD1 `introduction_order` is 0-based: 0 = war-start faction, 1/2 = later
// arrivals, 255 = not introduced this season.
const NOT_INTRODUCED = 255;

/**
 * Build a getCampaign-shaped fixture. `order` is enemy-indexed reveal slots;
 * `firstSeen` is enemy-indexed first-appearance timestamps (null = not seen).
 */
function makeData({ order, firstSeen, warStart = WAR_START }) {
    return {
        war_start: warStart,
        introduction_order: { order },
        status: firstSeen.map((first_seen, enemy) => ({ enemy, first_seen })),
    };
}

test('emits one marker per introduced faction with a known first_seen', () => {
    const data = makeData({
        order: [0, 1, 2],
        firstSeen: [WAR_START, WAR_START + 2 * DAY, WAR_START + 5 * DAY],
    });
    const markers = buildIntroMarkers(data);

    expect(markers).toHaveLength(3);
    expect(markers.map((m) => m.enemy)).toEqual([0, 1, 2]);
    expect(markers.map((m) => m.name)).toEqual(['Bugs', 'Cyborgs', 'Illuminate']);
    expect(markers.every((m) => m.kind === 'intro')).toBe(true);
});

test('flags only the war-start faction (order 0)', () => {
    const data = makeData({
        order: [0, 1, 2],
        firstSeen: [WAR_START, WAR_START + 2 * DAY, WAR_START + 5 * DAY],
    });
    const markers = buildIntroMarkers(data);
    // Bugs (order 0) started the war; the later arrivals merely joined it.
    expect(markers.map((m) => m.isWarStart)).toEqual([true, false, false]);
});

test('day is 1-based off war_start; war-start faction is Day 1', () => {
    const data = makeData({
        order: [0, 1, 2],
        firstSeen: [WAR_START, WAR_START + 2 * DAY, WAR_START + 5 * DAY],
    });
    const markers = buildIntroMarkers(data);
    // war start → Day 1, +2 days → Day 3, +5 days → Day 6.
    expect(markers.map((m) => m.day)).toEqual([1, 3, 6]);
});

test('strips the leading article from "The Illuminate"', () => {
    const data = makeData({
        order: [NOT_INTRODUCED, NOT_INTRODUCED, 0],
        firstSeen: [null, null, WAR_START + DAY],
    });
    const markers = buildIntroMarkers(data);
    expect(markers).toHaveLength(1);
    expect(markers[0].name).toBe('Illuminate');
});

test('skips factions never introduced (255 sentinel)', () => {
    const data = makeData({
        order: [0, NOT_INTRODUCED, 1], // cyborgs (enemy 1) never deployed
        firstSeen: [WAR_START, WAR_START + DAY, WAR_START + 2 * DAY],
    });
    const markers = buildIntroMarkers(data);
    expect(markers.map((m) => m.enemy)).toEqual([0, 2]);
    expect(markers.map((m) => m.isWarStart)).toEqual([true, false]);
});

test('skips introduced factions with a null first_seen', () => {
    const data = makeData({
        order: [0, 1, 2],
        firstSeen: [WAR_START, null, WAR_START + 3 * DAY], // cyborgs never seen
    });
    const markers = buildIntroMarkers(data);
    expect(markers.map((m) => m.enemy)).toEqual([0, 2]);
});

test('sorts markers ascending by time even when reveal order differs', () => {
    const data = makeData({
        order: [2, 0, 1], // reveal slots out of chronological order
        firstSeen: [WAR_START + 5 * DAY, WAR_START + DAY, WAR_START + 3 * DAY],
    });
    const markers = buildIntroMarkers(data);
    expect(markers.map((m) => m.enemy)).toEqual([1, 2, 0]);
    expect(markers.map((m) => m.time)).toEqual([
        WAR_START + DAY,
        WAR_START + 3 * DAY,
        WAR_START + 5 * DAY,
    ]);
    // Cyborgs (enemy 1, order 0) opened the war despite appearing mid-list.
    expect(markers.find((m) => m.enemy === 1).isWarStart).toBe(true);
});

test('falls back to the earliest first_seen when war_start is absent', () => {
    const data = makeData({
        order: [1, 2, 0],
        firstSeen: [WAR_START + 2 * DAY, WAR_START + DAY, null],
    });
    // Drop war_start entirely so the reduce-min fallback anchors Day 1.
    delete data.war_start;
    const markers = buildIntroMarkers(data);
    // The order-0 faction (illuminate) has no first_seen, so no war-start
    // marker; anchor = earliest candidate first_seen (cyborgs, +1 day) → Day 1.
    const cyborgs = markers.find((m) => m.enemy === 1);
    const bugs = markers.find((m) => m.enemy === 0);
    expect(cyborgs.day).toBe(1);
    expect(bugs.day).toBe(2);
    expect(markers.every((m) => m.isWarStart === false)).toBe(true);
});

test('returns [] for missing / malformed data', () => {
    expect(buildIntroMarkers(null)).toEqual([]);
    expect(buildIntroMarkers(undefined)).toEqual([]);
    expect(buildIntroMarkers({})).toEqual([]);
    expect(buildIntroMarkers({ introduction_order: { order: [0, 1, 2] } })).toEqual([]);
    expect(buildIntroMarkers({ status: [] })).toEqual([]);
});

test('returns [] when no faction is both introduced and seen', () => {
    const data = makeData({
        order: [NOT_INTRODUCED, NOT_INTRODUCED, NOT_INTRODUCED],
        firstSeen: [WAR_START, WAR_START, WAR_START],
    });
    expect(buildIntroMarkers(data)).toEqual([]);
});
