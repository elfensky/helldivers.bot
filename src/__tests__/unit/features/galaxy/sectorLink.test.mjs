// @vitest-environment jsdom
import { describe, test, expect, beforeEach } from 'vitest';
import { highlightSector, clearSectorHighlight } from '@/features/galaxy/sectorLink.mjs';

/**
 * Build a minimal stand-in for the Map.jsx SVG structure: a `#map` wrapper,
 * one `<g>` per faction keyed by faction string, sector elements classed
 * `.sector` with a numeric `data-name`. Plain divs — sectorLink only touches
 * ids, classes and data-attributes, never SVG geometry.
 */
function makeMapDom() {
    document.body.replaceChildren();
    const map = document.createElement('div');
    map.id = 'map';
    const addGroup = (id, sectors) => {
        const group = document.createElement('div');
        group.id = id;
        for (const name of sectors) {
            const sector = document.createElement('div');
            sector.className = 'sector';
            sector.setAttribute('data-name', String(name));
            group.appendChild(sector);
        }
        map.appendChild(group);
    };
    addGroup('bugs', [1, 2, 11]);
    addGroup('cyborgs', [1]);
    addGroup('superearth', [0]);
    document.body.appendChild(map);
}

beforeEach(makeMapDom);

describe('sectorLink', () => {
    test('faints the whole faction territory and strongly marks one sector', () => {
        highlightSector(0, 2);

        document
            .querySelectorAll('#bugs .sector')
            .forEach((el) =>
                expect(el.classList.contains('sector-linked-faint')).toBe(true),
            );

        const strong = document.querySelectorAll('.sector-linked-strong');
        expect(strong).toHaveLength(1);
        expect(strong[0].getAttribute('data-name')).toBe('2');

        expect(
            document.getElementById('map').classList.contains('is-sector-linking'),
        ).toBe(true);
        // a different faction is untouched
        expect(
            document
                .querySelector('#cyborgs .sector')
                .classList.contains('sector-linked-faint'),
        ).toBe(false);
    });

    test('clearSectorHighlight removes every link class and the map flag', () => {
        highlightSector(0, 2);
        clearSectorHighlight();

        expect(
            document.querySelectorAll('.sector-linked-faint, .sector-linked-strong'),
        ).toHaveLength(0);
        expect(
            document.getElementById('map').classList.contains('is-sector-linking'),
        ).toBe(false);
    });

    test('null sector (defeated faction) faints territory with no strong sector', () => {
        highlightSector(0, null);

        expect(document.querySelectorAll('#bugs .sector-linked-faint')).toHaveLength(3);
        expect(document.querySelectorAll('.sector-linked-strong')).toHaveLength(0);
    });

    test('Super Earth (faction index 3) resolves to the superearth group', () => {
        highlightSector(3, 0);

        const se = document.querySelector('#superearth .sector');
        expect(se.classList.contains('sector-linked-faint')).toBe(true);
        expect(se.classList.contains('sector-linked-strong')).toBe(true);
    });

    test('a new highlight clears the previous one first', () => {
        highlightSector(0, 2);
        highlightSector(1, 1);

        expect(document.querySelectorAll('#bugs .sector-linked-faint')).toHaveLength(0);
        expect(
            document
                .querySelector('#cyborgs .sector')
                .classList.contains('sector-linked-strong'),
        ).toBe(true);
    });
});
