// The 60 sextant blocks (U+1FB00–1FB3B), drawn by --font-cyberstan. An array,
// because each is a surrogate pair that string indexing would split.
const GLYPHS = Array.from({ length: 60 }, (_, i) => String.fromCodePoint(0x1fb00 + i));

/**
 * One random glitch glyph. Render it inside a `.glitch-char` span: only that
 * class sets the font that holds the sextants.
 * @returns {string}
 */
export function randomGlyph() {
    return GLYPHS[Math.floor(Math.random() * GLYPHS.length)];
}
