// @vitest-environment jsdom
import { describe, test, expect, beforeEach } from 'vitest';
import {
    highlightSector,
    clearSectorHighlight,
    highlightCard,
    clearCardHighlight,
} from '@/features/galaxy/sectorLink.mjs';

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

/**
 * Build a stand-in for the DashboardClient card grid: a `<ul>` of `<li>`
 * cards keyed by `data-faction-index`. A faction can own two cards (frontier
 * + homeworld); the Super Earth defence card additionally carries a
 * `data-attacker-index` so the attacking faction's territory highlights it.
 */
function makeCardDom() {
    document.body.replaceChildren();
    const ul = document.createElement('ul');
    ul.className = 'sector-grid';
    const addCard = (attrs) => {
        const li = document.createElement('li');
        for (const [k, v] of Object.entries(attrs)) li.setAttribute(k, String(v));
        ul.appendChild(li);
    };
    addCard({ 'data-faction-index': 0 }); // bugs — frontier
    addCard({ 'data-faction-index': 0, 'data-sector': 11 }); // bugs — homeworld
    addCard({ 'data-faction-index': 1 }); // cyborgs
    addCard({ 'data-faction-index': 3, 'data-attacker-index': 2 }); // SE defence, Illuminate attacking
    document.body.appendChild(ul);
}

describe('sectorLink', () => {
    beforeEach(makeMapDom);

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

describe('cardLink', () => {
    beforeEach(makeCardDom);

    test('highlightCard marks every card of the hovered faction', () => {
        highlightCard(0); // bugs owns two cards: frontier + homeworld

        const linked = document.querySelectorAll('.card-linked');
        expect(linked).toHaveLength(2);
        linked.forEach((el) => expect(el.getAttribute('data-faction-index')).toBe('0'));
        // a different faction is untouched
        expect(
            document
                .querySelector('li[data-faction-index="1"]')
                .classList.contains('card-linked'),
        ).toBe(false);
    });

    test('a single-card faction highlights just its one card', () => {
        highlightCard(1);

        const linked = document.querySelectorAll('.card-linked');
        expect(linked).toHaveLength(1);
        expect(linked[0].getAttribute('data-faction-index')).toBe('1');
    });

    test('hovering the attacking faction highlights the Super Earth defence card', () => {
        // The SE defence card carries data-attacker-index="2" (Illuminate attacking).
        highlightCard(2);

        const seCard = document.querySelector('li[data-faction-index="3"]');
        expect(seCard.classList.contains('card-linked')).toBe(true);
    });

    test('the Super Earth defence card also highlights from the superearth group', () => {
        highlightCard(3);

        const seCard = document.querySelector('li[data-faction-index="3"]');
        expect(seCard.classList.contains('card-linked')).toBe(true);
    });

    test('clearCardHighlight removes every card-linked class', () => {
        highlightCard(0);
        clearCardHighlight();

        expect(document.querySelectorAll('.card-linked')).toHaveLength(0);
    });

    test('a new card highlight clears the previous one first', () => {
        highlightCard(0);
        highlightCard(1);

        expect(
            document.querySelectorAll('li[data-faction-index="0"].card-linked'),
        ).toHaveLength(0);
        expect(document.querySelectorAll('.card-linked')).toHaveLength(1);
    });
});
