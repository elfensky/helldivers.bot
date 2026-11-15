/**
 * check-mermaid-fences.mjs — offline syntax check for the ```mermaid fences
 * in the docs MDX pages.
 *
 * Those fences render as raw `<pre>` text (`mdx-components.jsx`), so a browser
 * never reports a broken one. `mermaid.parse` is the parser the browser
 * diagrams use, run here under jsdom (mermaid needs `window` and `document`
 * before it is imported).
 *
 * No try/catch (AGENTS.md): a parse error is turned into a value with the
 * promise form, and an unreadable file throws and crashes the script loudly.
 * Not the app's `tryCatch` either, which reports to GlitchTip.
 *
 * Usage:
 *   node scripts/check-mermaid-fences.mjs [file.mdx ...]
 *   Default files: every page.mdx under src/app/docs, sorted.
 *
 * Output: one `OK <file> fence@<line>` or `FAIL <file> fence@<line> <error>`
 * line per fence, then `checked <N> fences in <M> files`.
 *
 * Exit code: 1 when any fence fails to parse or when zero fences were checked
 * (a check that inspects nothing must not pass); 0 otherwise. An unreadable
 * file exits non-zero through the uncaught error.
 */

import { readdirSync, readFileSync } from 'node:fs';
import { JSDOM } from 'jsdom';

const DOCS_DIR = 'src/app/docs';
const DEFAULT_FILES = readdirSync(DOCS_DIR, { recursive: true })
    .filter((f) => f.split('/').pop() === 'page.mdx')
    .map((f) => `${DOCS_DIR}/${f}`)
    .sort();

const dom = new JSDOM('<!DOCTYPE html><body></body>');
globalThis.window = dom.window;
globalThis.document = dom.window.document;
const { default: mermaid } = await import('mermaid');

const files = process.argv.length > 2 ? process.argv.slice(2) : DEFAULT_FILES;
let checked = 0;
let failed = 0;

for (const file of files) {
    const lines = readFileSync(file, 'utf8').split('\n');
    for (let i = 0; i < lines.length; i++) {
        if (!/^```mermaid\s*$/.test(lines[i])) continue;
        const start = i + 1;
        const body = [];
        for (i++; i < lines.length && !/^```\s*$/.test(lines[i]); i++)
            body.push(lines[i]);
        checked++;
        const error = await mermaid.parse(body.join('\n')).then(
            () => null,
            (e) => e,
        );
        if (error) {
            failed++;
            console.log(
                `FAIL ${file} fence@${start} ${String(error.message ?? error).split('\n')[0]}`,
            );
        } else {
            console.log(`OK ${file} fence@${start}`);
        }
    }
}

console.log(`checked ${checked} fences in ${files.length} files`);
process.exit(failed > 0 || checked === 0 ? 1 : 0);
