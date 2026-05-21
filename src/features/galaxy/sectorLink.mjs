/**
 * Card → map hover link. When a dashboard region card is hovered, highlight
 * the matching area on the galaxy map: the hovered faction's whole territory
 * gets a lit outline, and its one active sector a heavier one.
 *
 * Implemented by toggling CSS classes directly on the map's SVG nodes (the
 * MermaidDiagram pattern) rather than via React state — a hover effect must
 * not cost a re-render of the card grid plus ~33 map paths on every
 * mouse-move. The map (`Map.jsx`) renders `<g id="{faction}">` groups of
 * `<path class="sector" data-name="{n}">`; those ids / data-attributes are
 * the link keys, so no shared component or state is needed.
 *
 * Bidirectional (map → card) can be layered on later by calling the same
 * functions from the map's own hover handlers — see issue #185.
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
