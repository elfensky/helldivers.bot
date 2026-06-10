/**
 * Hover link between the dashboard region cards and the galaxy map, in both
 * directions:
 *
 *   - card → map (`highlightSector`): hovering a region card firms up the
 *     matching faction's map territory — see Map.css.
 *   - map → card (`highlightCard`): hovering a faction's map territory firms
 *     up that faction's sidebar card(s) — see EventCard.css.
 *
 * Implemented by toggling CSS classes directly on the DOM nodes (the
 * MermaidDiagram pattern) rather than via React state — a hover effect must
 * not cost a re-render of the card grid plus ~33 map paths on every
 * mouse-move. The map (`Map.jsx`) renders `<g id="{faction}">` groups of
 * `<path class="sector" data-name="{n}">`; the cards (`DashboardClient.jsx`)
 * carry `data-faction-index` / `data-attacker-index`. Those ids and
 * data-attributes are the link keys, so no shared component or state is needed.
 */

// Faction index → the `<g>` id used in Map.jsx.
const FACTION_GROUP = {
    0: 'bugs',
    1: 'cyborgs',
    2: 'illuminate',
    3: 'superearth',
};

/** Remove every hover-link class and the map-wide focus flag. */
export function clearSectorHighlight() {
    if (typeof document === 'undefined') return;
    document.getElementById('map')?.classList.remove('is-sector-linking');
    document
        .querySelectorAll('.sector-linked-faint, .sector-linked-strong')
        .forEach((el) =>
            el.classList.remove('sector-linked-faint', 'sector-linked-strong'),
        );
}

/**
 * Highlight a faction's map territory, with one sector emphasised.
 *
 * @param {number} factionIndex - 0 Bugs, 1 Cyborgs, 2 Illuminate, 3 Super Earth
 * @param {number | null} [sector] - Sector to mark strongly (1-11, or 0 for
 *   Super Earth). Null/omitted outlines the whole territory only — e.g. a
 *   defeated faction with no single active sector.
 */
export function highlightSector(factionIndex, sector = null) {
    if (typeof document === 'undefined') return;
    clearSectorHighlight();

    const group = FACTION_GROUP[factionIndex];
    if (!group) return;
    const groupEl = document.getElementById(group);
    if (!groupEl) return;

    document.getElementById('map')?.classList.add('is-sector-linking');

    const wanted = sector != null ? String(sector) : null;
    groupEl.querySelectorAll('.sector').forEach((el) => {
        el.classList.add('sector-linked-faint');
        if (wanted != null && el.dataset.name === wanted) {
            el.classList.add('sector-linked-strong');
        }
    });
}

/** Remove the hover-link class from every dashboard card. */
export function clearCardHighlight() {
    if (typeof document === 'undefined') return;
    document
        .querySelectorAll('.card-linked')
        .forEach((el) => el.classList.remove('card-linked'));
}

/**
 * Highlight a faction's dashboard card(s) — the map → card reverse of
 * `highlightSector`. Hovering a faction's map territory firms up the border
 * of its sidebar card(s); a faction can own more than one (frontier +
 * homeworld).
 *
 * @param {number} factionIndex - 0 Bugs, 1 Cyborgs, 2 Illuminate, 3 Super Earth
 */
export function highlightCard(factionIndex) {
    if (typeof document === 'undefined') return;
    clearCardHighlight();

    // A card matches by its own faction slot (`data-faction-index`) or — for
    // the Super Earth defence card — by the attacking faction it represents
    // (`data-attacker-index`), so hovering the attacker's territory lights it.
    document
        .querySelectorAll(
            `li[data-faction-index="${factionIndex}"], li[data-attacker-index="${factionIndex}"]`,
        )
        .forEach((el) => el.classList.add('card-linked'));
}
