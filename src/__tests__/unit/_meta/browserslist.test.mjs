import { describe, expect, test } from 'vitest';
import browserslist from 'browserslist';
import pkg from '../../../../package.json' with { type: 'json' };

// The floor exists because Map.groupBy shipped in Chrome 117 / Firefox 119 and
// silently broke the timeline on everything older (#495). Nothing declared a
// support target, so no tool could have caught it. These assertions pin the
// intent, not the exact list — widen or narrow deliberately, not by accident.
describe('browserslist', () => {
    test('declares a support floor', () => {
        expect(pkg.browserslist).toBeInstanceOf(Array);
        expect(pkg.browserslist.length).toBeGreaterThan(0);
    });

    test('still covers the last browsers for Windows 7/8', () => {
        const targets = browserslist(pkg.browserslist);

        // Firefox 115 ESR and Chrome 109 are the final versions for Win7/8 —
        // the reporter profile on #495.
        expect(targets).toContain('firefox 115');
        expect(targets).toContain('chrome 109');
    });

    test('excludes the targets that only produce noise', () => {
        const targets = browserslist(pkg.browserslist);

        // KaiOS and the stock Android browser lack service workers, which the
        // PWA is built on — keeping them would mean permanent lint errors for
        // a platform this site does not serve.
        expect(targets.some((t) => t.startsWith('kaios'))).toBe(false);
        expect(targets.some((t) => t.startsWith('android '))).toBe(false);
    });
});
