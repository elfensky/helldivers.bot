import { describe, test, expect } from 'vitest';
import { readdirSync, existsSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// The unit test tree mirrors the source tree, so the tests for a module are
// always where you would guess. When that drifts, someone checks the obvious
// location, concludes "untested", and writes a duplicate. This asserts the
// invariant mechanically.
//
// Rule — filesystem only, no import parsing:
//
//   a test at unit/<dir>/<Base>[.<qualifier>].test.<ext>
//   has a source file at <root>/<dir>/<Base>.*
//                     or <root>/<dir>/<Base>/{<Base>,index}.*
//   for <root> in { src, public }
//
// Deliberately NOT "the test's primary import", because there is no such
// thing: a test legitimately imports many modules, and some test a named
// export of a differently-named file (computeFrontier lives in EventCard.jsx,
// StatCard in StatGrid.jsx). Those are expressed as the <qualifier> segment,
// which this rule ignores.
//
// Three escape hatches, all name-based so there is no allowlist to rot:
//   unit/_meta/**          tests of the repo itself, not of a module
//   *.contract.test.*      a contract spanning several modules
//   *.integration.test.*   a test exercising several modules together

const HERE = path.dirname(fileURLToPath(import.meta.url));
const UNIT = path.resolve(HERE, '..');
const SRC = path.resolve(UNIT, '..', '..');
const REPO = path.resolve(SRC, '..');
const ROOTS = ['src', 'public'];

function testFiles(dir, out = []) {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) testFiles(full, out);
        else if (/\.test\.(mjs|jsx|js)$/.test(entry.name)) out.push(full);
    }
    return out;
}

// The module name a filename claims: everything before the first dot, so
// `StatGrid.StatCard.test.jsx` claims `StatGrid` and `route.test.mjs` claims
// `route`.
function moduleName(filename) {
    return filename.split('.')[0];
}

function hasSourceModule(dir, base) {
    return ROOTS.some((root) => {
        const sourceDir = path.join(REPO, root, dir);
        if (!existsSync(sourceDir) || !statSync(sourceDir).isDirectory()) return false;

        const entries = readdirSync(sourceDir, { withFileTypes: true });

        // <root>/<dir>/<Base>.<ext>
        if (entries.some((e) => !e.isDirectory() && moduleName(e.name) === base)) {
            return true;
        }

        // <root>/<dir>/<Base>/<Base>.<ext> — the per-component-folder shape.
        // src/shared/components/ mixes both, so both have to be accepted.
        const nested = entries.find((e) => e.isDirectory() && e.name === base);
        if (!nested) return false;
        return readdirSync(path.join(sourceDir, base)).some((e) =>
            [base, 'index'].includes(moduleName(e)),
        );
    });
}

function expectedSourcePaths(dir, base) {
    const where = dir === '.' ? '' : `${dir}/`;
    return ROOTS.map((root) => `${root}/${where}${base}.*`)
        .concat(ROOTS.map((root) => `${root}/${where}${base}/${base}.*`))
        .join('\n            or ');
}

describe('unit test tree mirrors the source tree', () => {
    test('every test file names a real source module in the mirrored directory', () => {
        const orphans = testFiles(UNIT)
            .map((abs) => path.relative(UNIT, abs))
            .filter((rel) => !rel.startsWith(`_meta${path.sep}`))
            .filter((rel) => !/\.(contract|integration)\.test\./.test(rel))
            .map((rel) => ({
                rel,
                dir: path.dirname(rel),
                base: moduleName(path.basename(rel)),
            }))
            .filter(({ dir, base }) => !hasSourceModule(dir, base))
            .sort((a, b) => a.rel.localeCompare(b.rel));

        // A bare array diff would not tell you how to fix this, and a
        // meta-test that looks unfixable is a meta-test someone deletes. Name
        // each offender AND the path it is claiming a module at.
        expect(
            orphans.map((o) => o.rel),
            orphans.length === 0 ?
                ''
            :   [
                    '',
                    `${orphans.length} test file(s) do not sit next to the module they test:`,
                    '',
                    ...orphans.flatMap(({ rel, dir, base }) => [
                        `  src/__tests__/unit/${rel}`,
                        `    -> needs ${expectedSourcePaths(dir, base)}`,
                        '',
                    ]),
                    'Pick one:',
                    '  1. Move the test to unit/<the source file’s own directory>/.',
                    '  2. Name it after its source module. A test for a named export of',
                    '     another file uses <HostModule>.<export>.test.* (see',
                    '     features/stats/StatGrid.StatCard.test.jsx). Several test files',
                    '     may share one module via <Module>.<concern>.test.*.',
                    '  3. If it genuinely has no single source module, use an escape hatch:',
                    '     unit/_meta/**          tests of the repo itself (package.json, jsconfig)',
                    '     *.contract.test.*      a contract spanning several modules',
                    '     *.integration.test.*   a test exercising several modules together',
                    '',
                ].join('\n'),
        ).toEqual([]);
    });
});
